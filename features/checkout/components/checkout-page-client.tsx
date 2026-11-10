"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, FileText, Lock, ShieldCheck, ShoppingBag } from "lucide-react";
import PaymentFeedback, { type PaymentUiPhase } from "@/components/checkout/payment-feedback";
import PurchaseTermsList from "@/components/catalog/purchase-terms-list";
import { useOptionalFeedback } from "@/components/feedback/feedback-provider";
import ProductImage from "@/components/images/product-image";
import LoadingButton from "@/components/ui/buttons/loading-button";
import MobileActionBar from "@/components/layout/mobile-action-bar";
import Button from "@/components/ui/button";
import CheckoutSkeleton from "@/components/ui/loaders/checkout-skeleton";
import NoticeCard from "@/components/ui/feedback/notice-card";
import CountBadge from "@/components/ui/count-badge";
import { TextAreaField } from "@/components/ui/form/text-field";
import PendingCard from "@/components/ui/feedback/pending-card";
import Skeleton from "@/components/ui/loaders/skeleton";
import Spinner from "@/components/ui/loaders/spinner";
import EmptyState from "@/components/ui/empty-state";
import OrderTotals from "@/features/cart/components/order-totals";
import { cartRows, lineProblemText, unitLabel, type CartRow } from "@/features/cart/cart-rows";
import { buyNowStore, cartActions, useCartItems } from "@/features/cart/cart-store";
import { useCartPricing } from "@/features/cart/use-cart-pricing";
import { openRazorpayCheckout } from "@/features/checkout/razorpay-checkout";
import { createPaymentOrder, verifyPayment, type AddressSelection } from "@/features/checkout/submit-checkout-order";
import CheckoutAddressPicker, { NEW_ADDRESS } from "@/features/checkout/components/checkout-address-picker";
import { readAddressForm } from "@/features/account/components/address-form-fields";
import { accountApi, toFieldErrors } from "@/features/account/account-api";
import type { AddressBook, FieldErrors } from "@/features/account/types";
import { useTenant } from "@/features/tenant/tenant-provider";
import { usePaymentStatusPoll } from "@/hooks/use-payment-status-poll";
import { authHref } from "@/lib/auth/redirect";
import type { SessionUser } from "@/lib/auth/session-user";
import type { PurchaseTerm } from "@/lib/catalog/purchase-terms";
import { useHydrated } from "@/lib/client/persistent-store";
import { formatNumber, formatRupees } from "@/lib/format";

type CheckoutPageClientProps = {
  buyNow: boolean;
  /** The signed-in shopper (checkout is behind sign-in). */
  customer: SessionUser;
  /** Printed on the invoice: the billing snapshot takes them from the profile. */
  business: { companyName: string; gstin: string };
  initialAddressBook: AddressBook;
  terms: PurchaseTerm[];
  /** Minutes an unpaid order holds its stock (store setting). */
  reservationMinutes: number;
};

type AddressErrors = { shipping: FieldErrors; billing: FieldErrors };

const NO_ADDRESS_ERRORS: AddressErrors = { shipping: {}, billing: {} };
const NOTE_LIMIT = 2000;
const PAYING: readonly PaymentUiPhase[] = ["creating_order", "awaiting_payment", "verifying_payment"];
const PAY_LABELS: Partial<Record<PaymentUiPhase, string>> = {
  creating_order: "Preparing payment…",
  awaiting_payment: "Waiting for Razorpay…",
  verifying_payment: "Confirming payment…",
};

/** Splits server errors such as "shippingAddress.pincode" into per-section field errors. */
function mapAddressErrors(errors: { field: string; message: string }[] | undefined) {
  const result: AddressErrors = { shipping: {}, billing: {} };
  for (const issue of errors ?? []) {
    const match = /^(shipping|billing)Address(?:Id)?(?:\.(.+))?$/.exec(issue.field);
    if (!match) continue;
    const [, kind, field] = match as unknown as [string, "shipping" | "billing", string | undefined];
    result[kind][field ?? `${kind}AddressId`] ??= issue.message;
  }
  return result;
}

const hasErrors = (errors: AddressErrors) => Object.keys(errors.shipping).length + Object.keys(errors.billing).length > 0;

function CheckoutStep({ step, id, title, action, children }: { step: number; id: string; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="checkout-step" aria-labelledby={`${id}-title`}>
      <header className="checkout-step__head">
        <span className="checkout-step__number" aria-hidden="true">{step}</span>
        <h2 id={`${id}-title`}>{title}</h2>
        {action ? <div className="checkout-step__action">{action}</div> : null}
      </header>
      <div className="checkout-step__body">{children}</div>
    </section>
  );
}

function CheckoutLine({ row, salesMode }: { row: CartRow; salesMode: "wholesale" | "retail" }) {
  const { line, item, problem } = row;
  if (!line) {
    return (
      <li className="checkout-line" aria-hidden="true">
        <Skeleton className="checkout-line__media" rounded="control" />
        <span className="checkout-line__info">
          <Skeleton className="ui-skeleton-line ui-skeleton-line--title" />
          <Skeleton className="ui-skeleton-line ui-skeleton-line--meta" />
        </span>
      </li>
    );
  }
  const name = line.name ?? "Product unavailable";
  return (
    <li className="checkout-line" data-problem={problem ? "" : undefined}>
      <span className="checkout-line__media">
        {line.imagePublicId || line.imageUrl ? (
          <ProductImage image={{ publicId: line.imagePublicId, url: line.imageUrl, alt: name }} preset="thumbnail" sizes="64px" />
        ) : null}
        <CountBadge count={item.quantity} corner max={Infinity} />
      </span>
      <span className="checkout-line__info">
        <strong>{name}</strong>
        {line.colorName || line.sku ? <small>{[line.colorName, line.sku].filter(Boolean).join(" · ")}</small> : null}
        {!line.unavailable ? (
          <small>
            {formatNumber(item.quantity)} × {formatRupees(row.unitPrice)}
            {row.unitPrice < row.basePrice ? <span className="checkout-line__badge">Bulk price</span> : null}
          </small>
        ) : null}
        {problem ? <small className="checkout-line__problem">{lineProblemText(problem, unitLabel(salesMode, 2))}</small> : null}
      </span>
      <strong className="checkout-line__total">{line.unavailable ? "—" : formatRupees(row.lineTotal)}</strong>
    </li>
  );
}

export default function CheckoutPageClient({
  buyNow,
  customer,
  business,
  initialAddressBook,
  terms,
  reservationMinutes,
}: CheckoutPageClientProps) {
  const tenant = useTenant();
  const router = useRouter();
  const feedback = useOptionalFeedback();
  const hydrated = useHydrated();
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const cartItems = useCartItems();
  const buyNowItem = buyNowStore.use();
  const [phase, setPhase] = useState<PaymentUiPhase>("idle");
  const [notice, setNotice] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [addressBook, setAddressBook] = useState(initialAddressBook);
  const [shippingChoice, setShippingChoice] = useState(initialAddressBook.defaultShippingId ?? NEW_ADDRESS);
  const [billingChoice, setBillingChoice] = useState(initialAddressBook.defaultBillingId ?? NEW_ADDRESS);
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [addressErrors, setAddressErrors] = useState<AddressErrors>(NO_ADDRESS_ERRORS);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const items = useMemo(() => (buyNow ? (buyNowItem ? [buyNowItem] : []) : cartItems), [buyNow, buyNowItem, cartItems]);
  const { pricing, linesByKey, error: pricingError, current, retry: repriceCart } = useCartPricing(items);
  const rows = useMemo(() => cartRows(items, linesByKey), [items, linesByKey]);
  const pieces = items.reduce((total, item) => total + item.quantity, 0);
  const flagged = rows.some((row) => row.problem) || (current && (pricing?.issues.length ?? 0) > 0);
  const savings = rows.reduce((total, row) => total + row.saving, 0);
  const paying = PAYING.includes(phase);
  const canPay = tenant.paymentsEnabled && current && !flagged && !pricingError;
  const totalLabel = current && pricing ? formatRupees(pricing.totals.totalAmount) : "…";
  const backHref = buyNow ? (rows[0]?.line?.slug ? `/products/${rows[0].line.slug}` : "/products") : "/cart";
  const salesMode = tenant.salesMode;
  const addressBookFull = addressBook.items.length >= addressBook.limit;
  const savedAddress = (id: string) => addressBook.items.find((address) => address.id === id) ?? null;

  // A payment outcome appears above the pay button; bring it into view (the shopper may be anywhere on a phone).
  useEffect(() => {
    if (phase === "failed" || phase === "cancelled" || phase === "pending") {
      statusRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [phase]);

  const handlePaymentConfirmed = useCallback(
    (orderNumber: string) => {
      if (!buyNow) cartActions.clear();
      cartActions.clearBuyNow();
      setPhase("success");
      router.push(`/checkout/confirmation?orderNumber=${encodeURIComponent(orderNumber)}`);
    },
    [buyNow, router],
  );

  const { refresh: refreshPaymentStatus, refreshing: refreshPending } = usePaymentStatusPoll({
    orderId: pendingOrderId,
    enabled: Boolean(pendingOrderId) && (phase === "pending" || phase === "cancelled"),
    onPaid: handlePaymentConfirmed,
    onFailed: () => {
      setPhase("failed");
      setNotice("The payment did not go through. You can try again.");
    },
  });

  function requireSignIn() {
    feedback?.warning("Please sign in again", "Your session ended. Sign in to place your order.");
    router.push(authHref(buyNow ? "/checkout?intent=buy-now" : "/checkout"));
  }

  /**
   * Turns the picker state into an order address. A new address the shopper
   * chose to save is stored first so the order references it by id; if saving
   * fails for a non-validation reason (e.g. the address book is full), checkout
   * continues with the address as entered.
   */
  async function resolveAddressSelection(kind: "shipping" | "billing", formData: FormData): Promise<AddressSelection | null> {
    const choice = kind === "shipping" ? shippingChoice : billingChoice;
    if (choice !== NEW_ADDRESS && savedAddress(choice)) return { addressId: choice };

    const address = readAddressForm(formData, `${kind}.`);
    if (formData.get(`${kind}.save`) !== "on") return { address };

    const makeDefault = formData.get(`${kind}.makeDefault`) === "on";
    try {
      const result = await accountApi.createAddress({
        ...address,
        makeDefaultShipping: kind === "shipping" && makeDefault,
        makeDefaultBilling: kind === "billing" && makeDefault,
      });
      if (!result.data) return { address };
      setAddressBook(result.data.book);
      (kind === "shipping" ? setShippingChoice : setBillingChoice)(result.data.address.id);
      return { addressId: result.data.address.id };
    } catch (error) {
      const fieldErrors = toFieldErrors(error);
      if (Object.keys(fieldErrors).length) {
        setAddressErrors((current) => ({ ...current, [kind]: fieldErrors }));
        return null;
      }
      feedback?.warning("Address not saved", "We'll still use it for this order.");
      return { address };
    }
  }

  async function submitPayment(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const form = formRef.current;
    if (!form || paying || startedRef.current || !canPay) return;

    startedRef.current = true;
    setNotice("");
    setPhase("creating_order");
    setAddressErrors(NO_ADDRESS_ERRORS);

    const formData = new FormData(form);
    // Read before a new address is saved: the saved copy only reaches state on the next render.
    const contact = savedAddress(shippingChoice) ?? readAddressForm(formData, "shipping.");
    const shipping = await resolveAddressSelection("shipping", formData);
    const billing = billingSameAsShipping ? null : await resolveAddressSelection("billing", formData);
    if (!shipping || (!billingSameAsShipping && !billing)) {
      startedRef.current = false;
      setPhase("idle");
      setNotice("Check the highlighted address fields.");
      return;
    }
    const notes = String(formData.get("notes") ?? "").trim().slice(0, NOTE_LIMIT);

    try {
      const { response, payload } = await createPaymentOrder(items, { shipping, billing, notes });
      if (response.status === 401) {
        // Signed out elsewhere (an expired access token was already renewed by fetchWithSession).
        startedRef.current = false;
        setPhase("idle");
        requireSignIn();
        return;
      }
      if (!response.ok || !payload.success || !payload.data) {
        startedRef.current = false;
        const fieldErrors = mapAddressErrors(payload.errors);
        if (hasErrors(fieldErrors)) {
          setAddressErrors(fieldErrors);
          setPhase("idle");
          setNotice("Check the highlighted address fields.");
          return;
        }
        // Stock or prices changed since the summary was priced: show the lines as they are now.
        if (response.status === 422) repriceCart();
        setPhase("failed");
        setNotice(payload.message ?? "We could not start the payment for this order.");
        return;
      }

      const order = payload.data;
      setPaymentReference(order.razorpayOrderId);
      setPendingOrderId(order.internalOrderId);
      setPhase("awaiting_payment");
      await openRazorpayCheckout({
        key: order.key,
        storeName: tenant.name,
        amount: order.amount,
        currency: order.currency,
        orderId: order.razorpayOrderId,
        customer: {
          name: contact.fullName || customer.name,
          email: customer.email,
          phone: contact.phone,
        },
        description: `Order ${order.orderNumber}`,
        onDismiss: () => {
          startedRef.current = false;
          setPhase("cancelled");
        },
        onSuccess: async (paymentResponse) => {
          setPhase("verifying_payment");
          setPaymentReference(paymentResponse.razorpay_payment_id);
          try {
            const verification = await verifyPayment(paymentResponse);
            if (verification.response.ok && verification.payload.success) {
              handlePaymentConfirmed(verification.payload.data.order?.orderNumber ?? order.orderNumber);
              return;
            }
            setPhase("pending");
            setNotice(verification.payload.message ?? "Your payment is being confirmed. This page updates by itself.");
          } catch {
            setPhase("pending");
            setNotice("Your payment is being confirmed. This page updates by itself, or check your orders shortly.");
          } finally {
            startedRef.current = false;
          }
        },
      });
    } catch {
      startedRef.current = false;
      setPhase("failed");
      setNotice("We could not reach the payment service. Check your connection and try again.");
    }
  }

  function retryPayment() {
    setPhase("idle");
    setNotice("");
    void submitPayment();
  }

  if (!hydrated) return <CheckoutSkeleton />;

  // Paid: the cart is already cleared while the confirmation page loads.
  if (phase === "success") {
    return (
      <main className="commerce-page content-width">
        <PendingCard title="Payment received" description="Opening your order confirmation…" action={<Spinner size="sm" label="Opening your order confirmation" />} />
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="commerce-page content-width">
        <EmptyState
          className="cart-empty"
          icon={<ShoppingBag size={26} strokeWidth={1.6} />}
          title={buyNow ? "This Buy now has expired" : "Nothing to check out"}
          description={
            buyNow
              ? "The product you chose with Buy now is no longer held in this tab. Open it again to continue."
              : "Your cart is empty. Add products to your cart to check out."
          }
          action={<Button href="/products">Browse catalogue</Button>}
        />
      </main>
    );
  }

  const shippingSaved = savedAddress(shippingChoice);
  const billingSaved = billingSameAsShipping ? shippingSaved : savedAddress(billingChoice);
  const invoiceGstin = billingSaved?.gstin || business.gstin;
  const showInvoice = (salesMode === "wholesale" || Boolean(business.companyName || business.gstin)) && (billingSameAsShipping || billingSaved);
  const contactLine = [tenant.contact.phone && `call ${tenant.contact.phone}`, tenant.contact.email && `email ${tenant.contact.email}`]
    .filter(Boolean)
    .join(" or ");
  // Phones show the amount beside the button (app/mobile.css), so the button just says "Pay now" there.
  const payLabel: ReactNode = !tenant.paymentsEnabled ? (
    "Payment unavailable"
  ) : flagged || pricingError ? (
    "Review your order"
  ) : current && pricing ? (
    <>
      <span className="checkout-pay__amount">Pay {formatRupees(pricing.totals.totalAmount)}</span>
      <span className="checkout-pay__short">Pay now</span>
    </>
  ) : (
    "Preparing your order…"
  );

  return (
    <main className="commerce-page content-width checkout-page">
      <header className="commerce-heading checkout-heading">
        <div>
          <p className="eyebrow">
            <Lock size={12} aria-hidden="true" /> Secure checkout
          </p>
          <h1>Checkout</h1>
          <p className="commerce-heading__meta">
            {buyNow ? "Buy now · " : null}
            {formatNumber(items.length)} {items.length === 1 ? "product" : "products"} · {formatNumber(pieces)} {unitLabel(salesMode, pieces)}
          </p>
        </div>
        <Link className="commerce-heading__link" href={backHref}>
          <ArrowLeft size={15} aria-hidden="true" /> {buyNow ? "Back to product" : "Back to cart"}
        </Link>
      </header>

      {/* Phones: the order summary folds into one line above the form. */}
      <button
        type="button"
        className="checkout-summary-toggle"
        aria-expanded={summaryOpen}
        aria-controls="checkout-order-summary"
        onClick={() => setSummaryOpen((value) => !value)}
      >
        <ShoppingBag size={17} aria-hidden="true" />
        <span>{summaryOpen ? "Hide" : "Show"} order summary</span>
        <ChevronDown size={16} aria-hidden="true" />
        <strong>{totalLabel}</strong>
      </button>

      <div className="checkout-layout">
        <form ref={formRef} className="checkout-form" onSubmit={submitPayment}>
          <CheckoutStep step={1} id="checkout-contact" title="Contact" action={<Link href="/account/profile">Edit profile</Link>}>
            <div className="checkout-account">
              <span className="checkout-account__avatar" aria-hidden="true">
                {(customer.name || customer.email).charAt(0).toUpperCase()}
              </span>
              <span className="checkout-account__who">
                <strong>{customer.name || customer.email}</strong>
                <span>{customer.email}</span>
              </span>
              <span className="checkout-account__note">Order updates appear in your notifications and on your orders page.</span>
            </div>
          </CheckoutStep>

          <CheckoutStep step={2} id="checkout-delivery" title="Delivery address">
            <CheckoutAddressPicker
              kind="shipping"
              addresses={addressBook.items}
              value={shippingChoice}
              onChange={setShippingChoice}
              errors={addressErrors.shipping}
              canSave
              atLimit={addressBookFull}
            />
          </CheckoutStep>

          <CheckoutStep step={3} id="checkout-billing" title="Billing & invoice">
            <label className="account-checkbox">
              <input type="checkbox" checked={billingSameAsShipping} onChange={(event) => setBillingSameAsShipping(event.currentTarget.checked)} />
              Bill to the delivery address
            </label>
            {!billingSameAsShipping ? (
              <CheckoutAddressPicker
                kind="billing"
                addresses={addressBook.items}
                value={billingChoice}
                onChange={setBillingChoice}
                errors={addressErrors.billing}
                canSave
                atLimit={addressBookFull}
              />
            ) : null}
            {showInvoice ? (
              <p className="checkout-invoice">
                <FileText size={17} strokeWidth={1.8} aria-hidden="true" />
                {business.companyName || invoiceGstin ? (
                  <span>
                    Invoice to <strong>{business.companyName || customer.name}</strong>
                    {invoiceGstin ? <> · GSTIN <span className="checkout-invoice__gstin">{invoiceGstin}</span></> : null}
                  </span>
                ) : (
                  <span>Add your business name and GSTIN to your profile to have them printed on the invoice.</span>
                )}
                <Link href="/account/profile">{!business.companyName && !invoiceGstin ? "Add details" : invoiceGstin ? "Edit" : "Add GSTIN"}</Link>
              </p>
            ) : null}
          </CheckoutStep>

          <CheckoutStep step={4} id="checkout-payment" title="Review & pay">
            {tenant.paymentsEnabled ? (
              <div className="checkout-method">
                <ShieldCheck size={22} strokeWidth={1.7} aria-hidden="true" />
                <span className="checkout-method__copy">
                  <strong>Pay securely with Razorpay</strong>
                  <small>Card details are entered with Razorpay, never on this site.</small>
                </span>
                <ul className="checkout-method__options" aria-label="Payment options">
                  <li>UPI</li>
                  <li>Cards</li>
                  <li>Net banking</li>
                  <li>Wallets</li>
                </ul>
              </div>
            ) : (
              <NoticeCard
                tone="warning"
                title="Online payment isn't available right now"
                description={contactLine ? `To complete this order, ${contactLine}.` : "Contact us to complete this order."}
                action={salesMode === "wholesale" && !buyNow ? <Link className="notice-link" href="/request-quote?from=cart">Request a quote</Link> : undefined}
              />
            )}

            <details className="checkout-note">
              <summary>Add a note for the store <span>(optional)</span></summary>
              <TextAreaField
                label="Order note"
                hideLabel
                name="notes"
                rows={3}
                maxLength={NOTE_LIMIT}
                placeholder="PO number, delivery instructions or packing requests"
                optional
              />
            </details>

            <div ref={statusRef} className="checkout-status">
              {notice && phase === "idle" ? <NoticeCard tone="danger" live="alert" title={notice} /> : null}
              <PaymentFeedback
                phase={phase}
                paymentReference={paymentReference || undefined}
                message={notice || undefined}
                holdMinutes={reservationMinutes}
                backHref={backHref}
                onRetry={retryPayment}
                onRefreshStatus={pendingOrderId ? () => void refreshPaymentStatus() : undefined}
                refreshPending={refreshPending}
              />
              {flagged && !paying ? (
                <NoticeCard
                  tone="warning"
                  title="Some items need your attention"
                  description="Quantities or stock changed since they were added."
                  action={buyNow ? undefined : <Link className="notice-link" href="/cart">Review cart</Link>}
                />
              ) : null}
              {pricingError && !flagged ? (
                <NoticeCard
                  tone="danger"
                  title="Prices couldn't be confirmed"
                  description={pricingError}
                  action={<button type="button" className="notice-link" onClick={repriceCart}>Try again</button>}
                />
              ) : null}
            </div>

            <MobileActionBar className="checkout-submit-bar">
              <p className="checkout-submit-bar__total">
                <span>To pay</span>
                <strong>{totalLabel}</strong>
              </p>
              <LoadingButton
                type="submit"
                className="checkout-pay"
                loading={paying}
                loadingText={PAY_LABELS[phase] ?? "Processing…"}
                disabled={!canPay}
                icon={<Lock size={15} aria-hidden="true" />}
              >
                {payLabel}
              </LoadingButton>
            </MobileActionBar>
            <p className="checkout-legal">
              Stock is held for {formatNumber(reservationMinutes)} minutes while you pay. By placing this order you agree to our{" "}
              <Link href="/terms-and-conditions">terms</Link> and <Link href="/returns">returns policy</Link>.
            </p>
          </CheckoutStep>
        </form>

        <aside id="checkout-order-summary" className="checkout-summary" data-open={summaryOpen || undefined} aria-labelledby="checkout-summary-title">
          <div className="checkout-summary__card">
            <div className="checkout-summary__head">
              <h2 id="checkout-summary-title">Order summary</h2>
              {!buyNow ? <Link href="/cart">Edit cart</Link> : null}
            </div>
            <ul className="checkout-lines" aria-busy={!current || undefined}>
              {rows.map((row) => <CheckoutLine key={row.key} row={row} salesMode={salesMode} />)}
            </ul>
            <OrderTotals totals={pricing?.totals ?? null} pieces={pieces} gstRates={pricing?.gstRates} salesMode={salesMode} updating={!current && pricing !== null} />
            {savings > 0 ? (
              <p className="order-savings">
                You save <strong>{formatRupees(savings)}</strong> {salesMode === "wholesale" ? "with bulk pricing" : "on this order"}
              </p>
            ) : null}
          </div>
          <PurchaseTermsList terms={terms} label="Payment, shipping and returns" className="purchase-terms--compact" />
        </aside>
      </div>
    </main>
  );
}
