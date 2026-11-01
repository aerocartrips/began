"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PaymentFeedback, { type PaymentUiPhase } from "@/components/checkout/payment-feedback";
import { useOptionalFeedback } from "@/components/feedback/feedback-provider";
import LoadingButton from "@/components/ui/buttons/loading-button";
import Button from "@/components/ui/button";
import CheckoutSkeleton from "@/components/ui/loaders/checkout-skeleton";
import ErrorCard from "@/components/ui/feedback/error-card";
import WarningCard from "@/components/ui/feedback/warning-card";
import CartSummary from "@/features/cart/components/cart-summary";
import { useCart } from "@/features/cart/cart-provider";
import EmptyState from "@/components/ui/empty-state";
import type { CartLine } from "@/features/cart/types/cart";
import { formatCurrency } from "@/lib/format-currency";
import { openRazorpayCheckout } from "@/features/checkout/razorpay-checkout";
import {
  createPaymentOrder,
  fetchCurrentCustomer,
  verifyPayment,
  type CheckoutAddress,
} from "@/features/checkout/submit-checkout-order";
import { usePaymentStatusPoll } from "@/hooks/use-payment-status-poll";

type CheckoutPageClientProps = {
  buyNow: boolean;
};

type LegacyPaymentPhase =
  | "idle"
  | "creating"
  | "checkout"
  | "verifying"
  | "success"
  | "failed"
  | "pending"
  | "cancelled";

function mapPaymentPhase(phase: LegacyPaymentPhase): PaymentUiPhase {
  switch (phase) {
    case "creating":
      return "creating_order";
    case "checkout":
      return "awaiting_payment";
    case "verifying":
      return "verifying_payment";
    case "success":
      return "success";
    case "failed":
      return "failed";
    case "pending":
      return "pending";
    case "cancelled":
      return "cancelled";
    default:
      return "idle";
  }
}

function CheckoutLine({ item }: { item: CartLine }) {
  return (
    <li className="checkout-line">
      <div className="checkout-line-image">
        <Image
          src={item.product.images[0].src}
          alt={item.product.images[0].alt}
          fill
          sizes="72px"
          className="cover-image"
        />
        <span>{item.quantity}</span>
      </div>
      <div className="checkout-line-copy">
        <strong>{item.product.title}</strong>
        <small>{item.product.details}</small>
      </div>
      <strong>{formatCurrency(item.lineTotalCents, item.product.currency)}</strong>
    </li>
  );
}

export default function CheckoutPageClient({ buyNow }: CheckoutPageClientProps) {
  const router = useRouter();
  const feedback = useOptionalFeedback();
  const paymentStartedRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { items, checkoutIntent, hydrated, clearCart, clearBuyNow } = useCart();
  const [notice, setNotice] = useState("");
  const [phase, setPhase] = useState<LegacyPaymentPhase>("idle");
  const [customer, setCustomer] = useState<Awaited<ReturnType<typeof fetchCurrentCustomer>>>(null);
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState("");
  const [lastPaymentReference, setLastPaymentReference] = useState("");
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const checkoutItems = buyNow ? (checkoutIntent ? [checkoutIntent] : []) : items;
  const checkoutCount = checkoutItems.reduce((count, item) => count + item.quantity, 0);
  const checkoutSubtotal = checkoutItems.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const razorpayEnabled = Boolean(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID);
  const pending =
    phase === "creating" || phase === "checkout" || phase === "verifying";
  const paymentUiPhase = mapPaymentPhase(phase);

  const handlePaymentConfirmed = useCallback(
    (orderNumber: string) => {
      if (!buyNow) clearCart();
      clearBuyNow();
      setConfirmedOrderNumber(orderNumber);
      setPhase("success");
      router.push(`/checkout/confirmation?orderNumber=${encodeURIComponent(orderNumber)}`);
    },
    [buyNow, clearBuyNow, clearCart, router],
  );

  const pollEnabled =
    Boolean(pendingOrderId) && (phase === "pending" || phase === "cancelled");

  const { refresh: refreshPaymentStatus, refreshing: refreshPending } = usePaymentStatusPoll({
    orderId: pendingOrderId,
    enabled: pollEnabled,
    onPaid: handlePaymentConfirmed,
    onFailed: () => {
      setPhase("failed");
      setNotice("Payment could not be completed. You can retry when ready.");
    },
  });

  useEffect(() => {
    fetchCurrentCustomer().then(setCustomer);
  }, []);

  async function submitPayment(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (pending || paymentStartedRef.current) return;

    setNotice("");
    const currentCustomer = await fetchCurrentCustomer();
    if (!currentCustomer) {
      feedback?.warning("Sign in required", "Sign in to place a wholesale order.");
      router.push(`/account/login?next=${encodeURIComponent(buyNow ? "/checkout?intent=buy-now" : "/checkout")}`);
      return;
    }
    setCustomer(currentCustomer);

    if (!razorpayEnabled) {
      setNotice("Online payment is not configured. Set Razorpay environment variables to enable Pay Now.");
      return;
    }

    const form = formRef.current ?? (event?.currentTarget instanceof HTMLFormElement ? event.currentTarget : null);
    if (!form) return;

    const formData = new FormData(form);
    const address: CheckoutAddress = {
      fullName: String(formData.get("name") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      addressLine1: String(formData.get("address") ?? "").trim(),
      city: String(formData.get("city") ?? "").trim(),
      state: String(formData.get("region") ?? "").trim(),
      pincode: String(formData.get("postalCode") ?? "").trim(),
      country: String(formData.get("country") ?? "").trim() || "India",
    };

    if (Object.values(address).some((value) => value.length === 0)) {
      setNotice("Complete all required shipping fields before paying.");
      return;
    }

    paymentStartedRef.current = true;
    setPhase("creating");

    try {
      const { response, payload } = await createPaymentOrder(checkoutItems, address);
      if (!response.ok || !payload.success || !payload.data) {
        paymentStartedRef.current = false;
        setPhase("failed");
        setNotice(payload.message ?? "We could not start payment for this order.");
        return;
      }

      setLastPaymentReference(payload.data.razorpayOrderId);
      setPendingOrderId(payload.data.internalOrderId);
      setPhase("checkout");
      await openRazorpayCheckout({
        key: payload.data.key,
        amount: payload.data.amount,
        currency: payload.data.currency,
        orderId: payload.data.razorpayOrderId,
        customer: {
          name: address.fullName,
          email: currentCustomer.email,
          phone: address.phone,
        },
        description: `Order ${payload.data.orderNumber}`,
        onDismiss: () => {
          paymentStartedRef.current = false;
          setPhase("cancelled");
          setNotice(
            "Your payment was not completed. You can retry when ready. If money was debited, wait for confirmation before paying again.",
          );
        },
        onSuccess: async (paymentResponse) => {
          setPhase("verifying");
          setLastPaymentReference(paymentResponse.razorpay_payment_id);
          try {
            const verification = await verifyPayment(paymentResponse);
            if (verification.response.ok && verification.payload.success) {
              if (!buyNow) clearCart();
              clearBuyNow();
              const orderNumber =
                verification.payload.data.order?.orderNumber ?? payload.data.orderNumber;
              handlePaymentConfirmed(orderNumber);
              return;
            }
            setPhase("pending");
            setNotice(
              verification.payload.message ??
                "Payment may have succeeded but verification is pending. We will reconcile automatically.",
            );
          } catch {
            setPhase("pending");
            setNotice(
              "Payment may have succeeded but verification is pending. Check your email or order history shortly.",
            );
          } finally {
            paymentStartedRef.current = false;
          }
        },
      });
    } catch {
      paymentStartedRef.current = false;
      setPhase("failed");
      setNotice("We could not reach the payment service.");
    }
  }

  if (!hydrated) {
    return <CheckoutSkeleton />;
  }

  if (checkoutItems.length === 0) {
    return (
      <main className="commerce-page content-width">
        <EmptyState
          title={buyNow ? "Purchase session unavailable" : "Nothing to checkout"}
          description={buyNow
            ? "The selected Buy Now item is missing or expired. Return to the catalog and start again."
            : "Add products to your cart before continuing to checkout."}
          action={<Button href="/products">Browse catalog</Button>}
        />
      </main>
    );
  }

  return (
    <main className="commerce-page content-width">
      <div className="commerce-heading">
        <div>
          <p className="eyebrow">{buyNow ? "Express purchase" : "Wholesale order"}</p>
          <h1>Checkout</h1>
        </div>
        {!buyNow && <Link className="text-button" href="/cart">Edit cart</Link>}
      </div>
      {!customer && (
        <WarningCard
          title="Sign in to continue"
          description="Wholesale checkout requires an authenticated business account."
          action={
            <Button
              href={`/account/login?next=${encodeURIComponent(buyNow ? "/checkout?intent=buy-now" : "/checkout")}`}
              variant="secondary"
            >
              Sign in
            </Button>
          }
        />
      )}
      {paymentUiPhase !== "idle" && paymentUiPhase !== "success" ? (
        <PaymentFeedback
          phase={paymentUiPhase}
          orderNumber={confirmedOrderNumber || undefined}
          paymentReference={lastPaymentReference || undefined}
          message={notice || undefined}
          refreshPending={refreshPending}
          onRefreshStatus={pendingOrderId ? () => void refreshPaymentStatus() : undefined}
          onRetry={() => {
            setPhase("idle");
            setNotice("");
            void submitPayment();
          }}
        />
      ) : null}
      {phase === "failed" && notice ? (
        <ErrorCard
          title="Unable to start payment"
          description={notice}
          action={
            <LoadingButton type="button" onClick={() => { setPhase("idle"); setNotice(""); }}>
              Try again
            </LoadingButton>
          }
        />
      ) : null}
      <div className="checkout-layout">
        <form ref={formRef} className="checkout-form" onSubmit={submitPayment}>
          <section className="checkout-form-section" aria-labelledby="contact-heading">
            <h2 id="contact-heading">Contact information</h2>
            <div className="checkout-fields">
              <label className="checkout-field checkout-field-wide">
                Full name
                <input name="name" autoComplete="name" required />
              </label>
              <label className="checkout-field checkout-field-wide">
                Business email
                <input name="email" type="email" autoComplete="email" required defaultValue={customer?.email ?? undefined} readOnly={Boolean(customer?.email)} />
              </label>
              <label className="checkout-field checkout-field-wide">
                Phone number
                <input name="phone" type="tel" autoComplete="tel" required />
              </label>
            </div>
          </section>
          <section className="checkout-form-section" aria-labelledby="shipping-heading">
            <h2 id="shipping-heading">Shipping destination</h2>
            <div className="checkout-fields">
              <label className="checkout-field checkout-field-wide">
                Address
                <input name="address" autoComplete="street-address" required />
              </label>
              <label className="checkout-field">
                City
                <input name="city" autoComplete="address-level2" required />
              </label>
              <label className="checkout-field">
                State or region
                <input name="region" autoComplete="address-level1" required />
              </label>
              <label className="checkout-field">
                Postal code
                <input name="postalCode" autoComplete="postal-code" required />
              </label>
              <label className="checkout-field">
                Country
                <input name="country" autoComplete="country-name" required defaultValue="India" />
              </label>
            </div>
          </section>
          <section className="checkout-payment-notice" aria-labelledby="payment-heading">
            <h2 id="payment-heading">Payment</h2>
            <p>
              Pay securely with Razorpay. Your order total, tax, shipping, MOQ, and inventory are validated on the server before checkout opens.
            </p>
          </section>
          {notice && phase !== "failed" && paymentUiPhase === "idle" ? (
            <p className="commerce-notice" role="status">{notice}</p>
          ) : null}
          <LoadingButton
            type="submit"
            className="checkout-submit"
            loading={pending}
            loadingText={
              phase === "creating"
                ? "Creating order..."
                : phase === "checkout"
                  ? "Awaiting Razorpay..."
                  : "Verifying payment..."
            }
            disabled={!razorpayEnabled}
          >
            {razorpayEnabled ? "Pay now with Razorpay" : "Payment unavailable"}
          </LoadingButton>
        </form>

        <aside className="checkout-order-summary" aria-labelledby="checkout-summary-title">
          <div className="checkout-summary-header">
            <h2 id="checkout-summary-title">Order summary</h2>
            {!buyNow && <Link href="/cart">Edit</Link>}
          </div>
          <ul className="checkout-lines">
            {checkoutItems.map((item) => <CheckoutLine item={item} key={item.key} />)}
          </ul>
          <CartSummary itemCount={checkoutCount} subtotalCents={checkoutSubtotal} showCheckout={false} />
        </aside>
      </div>
    </main>
  );
}
