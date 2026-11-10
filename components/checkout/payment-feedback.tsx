"use client";

import Button from "@/components/ui/button";
import ErrorCard from "@/components/ui/feedback/error-card";
import LoadingButton from "@/components/ui/buttons/loading-button";
import PendingCard from "@/components/ui/feedback/pending-card";
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
  paymentReference?: string;
  message?: string;
  /** How long the unpaid order holds its stock (store setting). */
  holdMinutes: number;
  /** Where "Back" leads when payment fails: the cart, or the product for Buy now. */
  backHref: string;
  onRetry: () => void;
  onRefreshStatus?: () => void;
  refreshPending?: boolean;
};

const IN_PROGRESS = {
  creating_order: "Preparing secure payment",
  awaiting_payment: "Complete your payment in the Razorpay window",
  verifying_payment: "Confirming your payment",
} as const;

/**
 * Checkout's one payment status card, from opening Razorpay to a failed,
 * cancelled or unconfirmed payment. Success leaves the page for the
 * confirmation, so it renders nothing here.
 */
export default function PaymentFeedback({
  phase,
  paymentReference,
  message,
  holdMinutes,
  backHref,
  onRetry,
  onRefreshStatus,
  refreshPending = false,
}: PaymentFeedbackProps) {
  if (phase === "creating_order" || phase === "awaiting_payment" || phase === "verifying_payment") {
    return (
      <PendingCard
        title={IN_PROGRESS[phase]}
        description="Keep this page open. It updates by itself once the payment is confirmed."
        action={<Spinner size="sm" label={IN_PROGRESS[phase]} />}
      />
    );
  }

  const refresh = onRefreshStatus ? (
    <LoadingButton type="button" variant="secondary" size="sm" loading={refreshPending} loadingText="Checking…" onClick={onRefreshStatus}>
      Check status
    </LoadingButton>
  ) : null;

  if (phase === "failed") {
    return (
      <ErrorCard
        title="Payment could not be completed"
        description={
          <>
            {message ?? "We could not confirm a payment. You have not been charged by this attempt."}
            {paymentReference ? <span className="notice-card__meta">Reference: {paymentReference}</span> : null}
          </>
        }
        action={
          <>
            <Button type="button" size="sm" onClick={onRetry}>Try again</Button>
            <Button href={backHref} variant="secondary" size="sm">Back</Button>
          </>
        }
      />
    );
  }

  if (phase === "pending") {
    return (
      <PendingCard
        title="Confirming your payment"
        description={message ?? "Your payment may still be processing. Please don't pay again until its status is confirmed."}
        action={refresh ?? undefined}
      />
    );
  }

  if (phase === "cancelled") {
    return (
      <WarningCard
        title="Payment not completed"
        description={`The payment window was closed before paying. Your items stay reserved for up to ${holdMinutes} minutes, so you can try again now. If money was debited, check the status before paying again.`}
        action={
          <>
            {refresh}
            <Button type="button" size="sm" onClick={onRetry}>Try again</Button>
          </>
        }
      />
    );
  }

  return null;
}
