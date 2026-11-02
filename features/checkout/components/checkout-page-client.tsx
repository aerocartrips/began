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
import { buyNowStore, cartActions, useCartItems } from "@/features/cart/cart-store";
import { useCartPricing } from "@/features/cart/use-cart-pricing";
import EmptyState from "@/components/ui/empty-state";
import type { PricedCartLine } from "@/features/cart/types";
import { formatRupees } from "@/lib/format";
import { useHydrated } from "@/lib/client/persistent-store";
import { openRazorpayCheckout } from "@/features/checkout/razorpay-checkout";
import {
  createPaymentOrder,
  fetchCurrentCustomer,
  verifyPayment,
  type AddressSelection,
} from "@/features/checkout/submit-checkout-order";
import CheckoutAddressPicker, { NEW_ADDRESS } from "@/features/checkout/components/checkout-address-picker";
import { readAddressForm } from "@/features/account/components/address-form-fields";
import { accountApi, toFieldErrors } from "@/features/account/account-api";
import type { AddressBook, FieldErrors } from "@/features/account/types";
import { usePaymentStatusPoll } from "@/hooks/use-payment-status-poll";
import { useTenant } from "@/features/tenant/tenant-provider";

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

/** Splits server errors such as "shippingAddress.pincode" into per-section field errors. */
function mapAddressErrors(errors: { field: string; message: string }[] | undefined) {
  const result: { shipping: FieldErrors; billing: FieldErrors } = { shipping: {}, billing: {} };
  for (const issue of errors ?? []) {
    const match = /^(shipping|billing)Address(?:Id)?(?:\.(.+))?$/.exec(issue.field);
    if (!match) continue;
    const [, kind, field] = match as unknown as [string, "shipping" | "billing", string | undefined];
    result[kind][field ?? `${kind}AddressId`] ??= issue.message;
  }
  return result;
}

function CheckoutLine({ item }: { item: PricedCartLine }) {
  return (
    <li className="checkout-line">
      <div className="checkout-line-image">
        {item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="72px" className="cover-image" /> : null}
        <span>{item.quantity}</span>
      </div>
      <div className="checkout-line-copy">
        <strong>{item.name ?? "Unavailable product"}</strong>
        <small>{[item.colorName, item.sku].filter(Boolean).join(" · ")}</small>
        {item.issues?.map((issue) => <small key={issue.message} className="cart-line__issue">{issue.message}</small>)}
      </div>
      <strong>{formatRupees(item.lineTotal ?? 0)}</strong>
    </li>
  );
}

export default function CheckoutPageClient({ buyNow }: CheckoutPageClientProps) {
  const tenant = useTenant();
  const router = useRouter();
  const feedback = useOptionalFeedback();
  const paymentStartedRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const hydrated = useHydrated();
  const cartItems = useCartItems();
  const buyNowItem = buyNowStore.use();
  const clearCart = cartActions.clear;
  const clearBuyNow = cartActions.clearBuyNow;
  const [notice, setNotice] = useState("");
  const [phase, setPhase] = useState<LegacyPaymentPhase>("idle");
  const [customer, setCustomer] = useState<Awaited<ReturnType<typeof fetchCurrentCustomer>>>(null);
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState("");
  const [lastPaymentReference, setLastPaymentReference] = useState("");
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [addressBook, setAddressBook] = useState<AddressBook | null>(null);
  const [shippingChoice, setShippingChoice] = useState(NEW_ADDRESS);
  const [billingChoice, setBillingChoice] = useState(NEW_ADDRESS);
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [addressErrors, setAddressErrors] = useState<{ shipping: FieldErrors; billing: FieldErrors }>({ shipping: {}, billing: {} });
  const addressBookFull = addressBook ? addressBook.items.length >= addressBook.limit : false;
  const checkoutItems = buyNow ? (buyNowItem ? [buyNowItem] : []) : cartItems;
  const checkoutCount = checkoutItems.reduce((count, item) => count + item.quantity, 0);
  const { pricing, loading: pricingLoading, error: pricingError } = useCartPricing(checkoutItems);
  const pricingBlocked = Boolean(pricingError) || (pricing?.issues.length ?? 0) > 0;
  const razorpayEnabled = tenant.paymentsEnabled && !pricingBlocked && !pricingLoading;
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
    let cancelled = false;
    void fetchCurrentCustomer().then(async (current) => {
      if (cancelled) return;
      setCustomer(current);
      if (!current) return;
      const book = await accountApi.fetchAddresses().then((result) => result.data).catch(() => null);
      if (cancelled || !book) return;
      setAddressBook(book);
      setShippingChoice(book.defaultShippingId ?? NEW_ADDRESS);
      setBillingChoice(book.defaultBillingId ?? NEW_ADDRESS);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Turns the picker state into an order address. A new address the customer
   * chose to save is stored first so the order references it by id; if saving
   * fails for a non-validation reason (e.g. the address book is full), checkout
   * continues with the address as entered.
   */
  async function resolveAddressSelection(kind: "shipping" | "billing", formData: FormData): Promise<AddressSelection | null> {
    const choice = kind === "shipping" ? shippingChoice : billingChoice;
    if (choice !== NEW_ADDRESS && addressBook?.items.some((address) => address.id === choice)) {
      return { addressId: choice };
    }

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

    paymentStartedRef.current = true;
    setPhase("creating");
    setAddressErrors({ shipping: {}, billing: {} });

    const formData = new FormData(form);
    const shipping = await resolveAddressSelection("shipping", formData);
    const billing = billingSameAsShipping ? null : await resolveAddressSelection("billing", formData);
    if (!shipping || (!billingSameAsShipping && !billing)) {
      paymentStartedRef.current = false;
      setPhase("idle");
      setNotice("Check the highlighted address fields before paying.");
      return;
    }
    const contact =
      "address" in shipping ? shipping.address : addressBook?.items.find((address) => address.id === shipping.addressId);

    try {
      const { response, payload } = await createPaymentOrder(checkoutItems, shipping, billing);
      if (!response.ok || !payload.success || !payload.data) {
        paymentStartedRef.current = false;
        setAddressErrors(mapAddressErrors(payload.errors));
        setPhase("failed");
        setNotice(payload.message ?? "We could not start payment for this order.");
        return;
      }

      setLastPaymentReference(payload.data.razorpayOrderId);
      setPendingOrderId(payload.data.internalOrderId);
      setPhase("checkout");
      await openRazorpayCheckout({
        key: payload.data.key,
        storeName: tenant.name,
        amount: payload.data.amount,
        currency: payload.data.currency,
        orderId: payload.data.razorpayOrderId,
        customer: {
          name: contact?.fullName ?? currentCustomer.name,
          email: currentCustomer.email,
          phone: contact?.phone ?? "",
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
          <p className="eyebrow">{buyNow ? "Express purchase" : tenant.salesMode === "wholesale" ? "Wholesale order" : "Your order"}</p>
          <h1>Checkout</h1>
        </div>
        {!buyNow && <Link className="text-button" href="/cart">Edit cart</Link>}
      </div>
      {!customer && (
        <WarningCard
          title="Sign in to continue"
          description={tenant.salesMode === "wholesale" ? "Wholesale checkout requires a signed-in business account." : "Sign in or create an account to place your order."}
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
                Business email
                <input name="email" type="email" autoComplete="email" required defaultValue={customer?.email ?? undefined} readOnly={Boolean(customer?.email)} />
              </label>
            </div>
          </section>
          <section className="checkout-form-section" aria-labelledby="shipping-heading">
            <h2 id="shipping-heading">Shipping destination</h2>
            <CheckoutAddressPicker
              kind="shipping"
              addresses={addressBook?.items ?? []}
              value={shippingChoice}
              onChange={setShippingChoice}
              errors={addressErrors.shipping}
              canSave={Boolean(customer)}
              atLimit={addressBookFull}
            />
          </section>
          <section className="checkout-form-section" aria-labelledby="billing-heading">
            <h2 id="billing-heading">Billing address</h2>
            <label className="account-checkbox">
              <input type="checkbox" checked={billingSameAsShipping} onChange={(event) => setBillingSameAsShipping(event.currentTarget.checked)} />
              Same as shipping address
            </label>
            {!billingSameAsShipping ? (
              <CheckoutAddressPicker
                kind="billing"
                addresses={addressBook?.items ?? []}
                value={billingChoice}
                onChange={setBillingChoice}
                errors={addressErrors.billing}
                canSave={Boolean(customer)}
                atLimit={addressBookFull}
              />
            ) : null}
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
            {razorpayEnabled ? "Pay now with Razorpay" : pricingBlocked ? "Fix your cart to pay" : tenant.paymentsEnabled ? "Preparing order…" : "Payment unavailable"}
          </LoadingButton>
        </form>

        <aside className="checkout-order-summary" aria-labelledby="checkout-summary-title">
          <div className="checkout-summary-header">
            <h2 id="checkout-summary-title">Order summary</h2>
            {!buyNow && <Link href="/cart">Edit</Link>}
          </div>
          <ul className="checkout-lines">
            {(pricing?.lines ?? []).map((item) => <CheckoutLine item={item} key={`${item.productId}:${item.variantId ?? ""}`} />)}
          </ul>
          {pricingError ? <p className="cart-line__issue" role="alert">{pricingError}</p> : null}
          <CartSummary itemCount={checkoutCount} totals={pricing?.totals ?? null} loading={pricingLoading} showCheckout={false} />
        </aside>
      </div>
    </main>
  );
}
