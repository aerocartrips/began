"use client";

import type { ReactNode } from "react";
import Button from "@/components/ui/button";
import ErrorCard from "@/components/ui/feedback/error-card";
import LoadingButton from "@/components/ui/buttons/loading-button";
import PendingCard from "@/components/ui/feedback/pending-card";
import SuccessCard from "@/components/ui/feedback/success-card";
import WarningCard from "@/components/ui/feedback/warning-card";
import Spinner from "@/components/ui/loaders/spinner";

export type PaymentUiPhase =
  | "idle"
  | "creating_order"
  | "awaiting_payment"
  | "verifying_payment"
  | "success"
  | "failed"
  | "pending"
  | "cancelled";

type PaymentFeedbackProps = {
  phase: PaymentUiPhase;
  orderNumber?: string;
  amountLabel?: string;
  methodLabel?: string;
  paymentReference?: string;
  message?: string;
  onRetry?: () => void;
  onRefreshStatus?: () => void;
  refreshPending?: boolean;
  extra?: ReactNode;
};

export default function PaymentFeedback({
  phase,
  orderNumber,
  amountLabel,
  methodLabel,
  paymentReference,
  message,
  onRetry,
  onRefreshStatus,
  refreshPending = false,
  extra,
}: PaymentFeedbackProps) {
  if (phase === "idle") return null;

  if (phase === "creating_order" || phase === "awaiting_payment" || phase === "verifying_payment") {
    const labels = {
      creating_order: "Preparing secure checkout",
      awaiting_payment: "Complete payment in Razorpay",
      verifying_payment: "Verifying payment with our servers",
    } as const;

    return (
      <PendingCard
        title={labels[phase]}
        description="Please keep this page open until verification finishes. Do not refresh during payment."
        action={
          <div className="feedback-inline-status">
            <Spinner size="sm" label={labels[phase]} />
          </div>
        }
      />
    );
  }

  if (phase === "success") {
    return (
      <SuccessCard
        title="Order placed successfully"
        description="Your payment was verified and captured. Fulfillment updates will follow separately."
        detail={
          <>
            {orderNumber ? (
              <p>
                Order number: <strong>{orderNumber}</strong>
              </p>
            ) : null}
            {amountLabel ? <p>Amount paid: {amountLabel}</p> : null}
            {methodLabel ? <p>Payment method: {methodLabel}</p> : null}
          </>
        }
        action={
          <>
            {orderNumber ? (
              <Button href={`/checkout/confirmation?orderNumber=${encodeURIComponent(orderNumber)}`}>
                View confirmation
              </Button>
            ) : null}
            <Button href="/products" variant="secondary">
              Continue shopping
            </Button>
          </>
        }
      />
    );
  }

  if (phase === "failed") {
    return (
      <ErrorCard
        title="Payment could not be completed"
        description={
          message ??
          "We could not confirm a successful payment. You have not been charged again by this page."
        }
        action={
          <>
            {paymentReference ? <p className="feedback-card__meta">Reference: {paymentReference}</p> : null}
            {onRetry ? (
              <Button type="button" onClick={onRetry}>
                Retry payment
              </Button>
            ) : null}
            <Button href="/cart" variant="secondary">
              Back to cart
            </Button>
          </>
        }
      />
    );
  }

  if (phase === "pending") {
    return (
      <PendingCard
        title="Payment confirmation pending"
        description={
          message ??
          "Your payment may still be processing. Please do not pay again until the status is confirmed."
        }
        action={
          onRefreshStatus ? (
            <LoadingButton
              type="button"
              variant="secondary"
              loading={refreshPending}
              loadingText="Checking..."
              onClick={onRefreshStatus}
            >
              Refresh status
            </LoadingButton>
          ) : undefined
        }
      />
    );
  }

  if (phase === "cancelled") {
    return (
      <WarningCard
        title="Payment not completed"
        description="You closed checkout before finishing payment. Your wholesale order remains reserved for a limited time."
        action={
          <>
            {onRefreshStatus ? (
              <LoadingButton
                type="button"
                variant="secondary"
                loading={refreshPending}
                loadingText="Checking..."
                onClick={onRefreshStatus}
              >
                Refresh status
              </LoadingButton>
            ) : null}
            {onRetry ? (
              <Button type="button" onClick={onRetry}>
                Retry when ready
              </Button>
            ) : null}
          </>
        }
      />
    );
  }

  return extra ?? null;
}
