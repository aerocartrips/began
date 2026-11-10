import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Check, Clock3 } from "lucide-react";
import ProductImage from "@/components/images/product-image";
import DownloadInvoiceButton from "@/components/orders/download-invoice-button";
import Button from "@/components/ui/button";
import CountBadge from "@/components/ui/count-badge";
import Skeleton from "@/components/ui/loaders/skeleton";
import OrderTotals from "@/features/cart/components/order-totals";
import { requireAccountUser } from "@/lib/auth/current-customer";
import { hasInvoice } from "@/lib/constants/order-status";
import { getStorePolicies } from "@/lib/content/pages";
import { formatNumber, formatRupees, humanizeStatus } from "@/lib/format";
import { getCustomerOrderByNumber } from "@/lib/services/order.service";
import { withCurrentTenant } from "@/lib/tenant/current";

export const metadata: Metadata = {
  title: "Order confirmation",
  robots: { index: false },
};

type ConfirmationPageProps = {
  searchParams: Promise<{ orderNumber?: string | string[] }>;
};

type Address = Record<string, string | undefined>;

/** In the store's time zone, wherever the server runs. */
const placedAt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

function AddressBlock({ title, address }: { title: string; address: Address }) {
  return (
    <div className="confirmation-address">
      <h3>{title}</h3>
      <address>
        <strong>{address.fullName}</strong>
        {address.companyName ? <span>{address.companyName}</span> : null}
        <span>{[address.addressLine1, address.addressLine2].filter(Boolean).join(", ")}</span>
        <span>{[address.city, address.state, address.pincode].filter(Boolean).join(", ")}</span>
        {address.phone ? <span>{address.phone}</span> : null}
        {address.gstin ? <span className="confirmation-address__gstin">GSTIN {address.gstin}</span> : null}
      </address>
    </div>
  );
}

function ConfirmationSkeleton() {
  return (
    <div aria-busy="true">
      <Skeleton className="ui-skeleton-panel confirmation-skeleton" rounded="card" />
      <span className="sr-only">Loading your order</span>
    </div>
  );
}

async function Confirmation({ searchParams }: ConfirmationPageProps) {
  const raw = (await searchParams).orderNumber;
  const orderNumber = typeof raw === "string" ? raw.trim() : "";
  const user = await requireAccountUser(
    orderNumber ? `/checkout/confirmation?orderNumber=${encodeURIComponent(orderNumber)}` : "/account/orders",
  );
  const [order, policies, salesMode] = await withCurrentTenant(async (tenant) =>
    Promise.all([getCustomerOrderByNumber(user, orderNumber), getStorePolicies(tenant.id), tenant.salesMode]),
  );

  if (!order) {
    return (
      <section className="confirmation-hero confirmation-hero--warning">
        <span className="confirmation-hero__icon" aria-hidden="true"><AlertTriangle size={28} /></span>
        <p className="eyebrow">Order not found</p>
        <h1>We couldn&apos;t find that order</h1>
        <p>It may belong to another account. Every order you place is listed on your orders page.</p>
        <div className="confirmation-hero__actions">
          <Button href="/account/orders" icon={<ArrowRight size={16} aria-hidden="true" />}>My orders</Button>
          <Button href="/products" variant="secondary">Continue shopping</Button>
        </div>
      </section>
    );
  }

  const firstName = (user.name ?? "").trim().split(/\s+/)[0];
  const paid = order.paymentStatus === "paid";
  // Unpaid past the payment window (or failed): no longer "about to be confirmed".
  const state = order.orderStatus === "cancelled" ? "cancelled" : paid ? "confirmed" : order.actions.awaitingPayment ? "pending" : "unpaid";
  const pieces = order.items.reduce((total: number, item: { quantity: number }) => total + item.quantity, 0);
  const orderHref = `/account/orders/${order._id}`;
  const billing: Address = order.billingAddress?.fullName ? order.billingAddress : order.shippingAddress;
  const number = <strong>{order.orderNumber}</strong>;
  const hero = {
    confirmed: {
      icon: <Check size={30} strokeWidth={2.4} />,
      eyebrow: "Order confirmed",
      title: `Thank you${firstName ? `, ${firstName}` : ""}!`,
      text: <>We received <strong>{formatRupees(order.totalAmount)}</strong> for order {number}. It&apos;s confirmed and we&apos;ll start preparing it now.</>,
    },
    pending: {
      icon: <Clock3 size={28} />,
      eyebrow: "Payment processing",
      title: "We're confirming your payment",
      text: <>Order {number} is waiting for the payment provider&apos;s confirmation, which usually takes a moment. Please don&apos;t pay again; this order updates by itself.</>,
    },
    unpaid: {
      icon: <AlertTriangle size={28} />,
      eyebrow: "Payment not received",
      title: "This order wasn't paid",
      text: <>No payment was confirmed for order {number}. If money was debited, it shows on the order page; otherwise you can check out again.</>,
    },
    cancelled: {
      icon: <AlertTriangle size={28} />,
      eyebrow: "Order cancelled",
      title: "This order was cancelled",
      text: <>Order {number} was cancelled. If you were charged, the refund appears on the order page.</>,
    },
  }[state];

  return (
    <>
      <section className={`confirmation-hero confirmation-hero--${state}`}>
        <span className="confirmation-hero__icon" aria-hidden="true">{hero.icon}</span>
        <p className="eyebrow">{hero.eyebrow}</p>
        <h1>{hero.title}</h1>
        <p>{hero.text}</p>
        <div className="confirmation-hero__actions">
          <Button href={orderHref} icon={<ArrowRight size={16} aria-hidden="true" />}>View order</Button>
          <Button href="/products" variant="secondary">Continue shopping</Button>
        </div>
      </section>

      <div className="confirmation-layout">
        <section className="confirmation-card" aria-labelledby="confirmation-items-title">
          <h2 id="confirmation-items-title">
            Items <span>· {formatNumber(order.items.length)} {order.items.length === 1 ? "product" : "products"}, {formatNumber(pieces)} pcs</span>
          </h2>
          <ul className="confirmation-items">
            {order.items.map((item: { product: string | null; variantId: string | null; productName: string; sku: string; colorName: string; quantity: number; unitPrice: number; lineTotal: number; imageUrl: string }) => (
              <li key={`${item.product}:${item.variantId ?? ""}`} className="checkout-line">
                <span className="checkout-line__media">
                  {item.imageUrl ? <ProductImage image={{ url: item.imageUrl, alt: item.productName }} preset="thumbnail" sizes="64px" /> : null}
                  <CountBadge count={item.quantity} corner max={Infinity} />
                </span>
                <span className="checkout-line__info">
                  <strong>{item.productName}</strong>
                  <small>{[item.colorName, item.sku].filter(Boolean).join(" · ")}</small>
                  <small>{formatNumber(item.quantity)} × {formatRupees(item.unitPrice)}</small>
                </span>
                <strong className="checkout-line__total">{formatRupees(item.lineTotal)}</strong>
              </li>
            ))}
          </ul>
          <OrderTotals totals={order} pieces={pieces} salesMode={salesMode} totalLabel={paid ? "Paid" : "Total"} />
          <div className="confirmation-addresses">
            <AddressBlock title="Delivery address" address={order.shippingAddress} />
            <AddressBlock title="Billing address" address={billing} />
          </div>
          {order.notes ? (
            <div className="confirmation-note">
              <h3>Your note</h3>
              <p className="order-note">{order.notes}</p>
            </div>
          ) : null}
        </section>

        <aside className="confirmation-aside">
          <section className="confirmation-card" aria-labelledby="confirmation-facts-title">
            <h2 id="confirmation-facts-title">Order details</h2>
            <dl className="confirmation-facts">
              <div><dt>Order number</dt><dd className="is-code">{order.orderNumber}</dd></div>
              <div><dt>Placed</dt><dd>{placedAt.format(new Date(order.createdAt))}</dd></div>
              <div><dt>Payment</dt><dd>{humanizeStatus(order.paymentStatus)} · {humanizeStatus(order.paymentMethod ?? "razorpay")}</dd></div>
              {order.invoice?.number ? <div><dt>Invoice</dt><dd className="is-code">{order.invoice.number}</dd></div> : null}
            </dl>
            {hasInvoice(order.paymentStatus) ? <DownloadInvoiceButton orderId={order._id} /> : null}
          </section>

          {state === "confirmed" ? (
            <section className="confirmation-card" aria-labelledby="confirmation-next-title">
              <h2 id="confirmation-next-title">What happens next</h2>
              <ol className="confirmation-steps">
                <li className="is-done">
                  <strong>Order confirmed</strong>
                  <small>Payment received. It&apos;s also in your notifications.</small>
                </li>
                <li>
                  <strong>Packed and shipped</strong>
                  <small>The courier and tracking number appear on your order page.</small>
                </li>
                <li>
                  <strong>Delivered</strong>
                  <small>
                    {policies.returnWindowDays > 0
                      ? `Something not right? Request a return within ${policies.returnWindowDays} days of delivery.`
                      : "Check your parcel on arrival."}
                  </small>
                </li>
              </ol>
            </section>
          ) : null}

          <p className="confirmation-help">
            Questions about this order? <Link href="/contact">Contact us</Link> and mention {order.orderNumber}.
          </p>
        </aside>
      </div>
    </>
  );
}

/** The order the shopper just paid for, read on the server for their account. */
export default function CheckoutConfirmationPage(props: ConfirmationPageProps) {
  return (
    <main className="commerce-page content-width confirmation-page">
      <Suspense fallback={<ConfirmationSkeleton />}>
        <Confirmation searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
