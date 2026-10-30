"use client";

import { useId, useState } from "react";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import LoadingButton from "@/components/ui/buttons/LoadingButton";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { apiRequest } from "@/lib/api/api-client";

type PaymentRefundTarget = {
  _id: string;
  amount: number;
  currency: string;
  status: string;
  razorpayPaymentId?: string;
  refundedAmount?: number;
  order?: { _id?: string; orderNumber?: string };
};

type PaymentRefundPanelProps = {
  payment: PaymentRefundTarget;
  onCompleted?: () => void;
};

export default function PaymentRefundPanel({ payment, onCompleted }: PaymentRefundPanelProps) {
  const feedback = useFeedback();
  const reasonId = useId();
  const [reason, setReason] = useState("");
  const [partialPaise, setPartialPaise] = useState("");
  const remainingPaise = Math.max(0, payment.amount - (payment.refundedAmount ?? 0));
  const canRefund =
    Boolean(payment.razorpayPaymentId) &&
    remainingPaise > 0 &&
    (payment.status === "captured" || payment.status === "partially_refunded");

  const { run: submitRefund, loading } = useAsyncAction(async () => {
    const orderId = payment.order?._id;
    if (!orderId) {
      feedback.error("Refund unavailable", "This payment is not linked to an order.");
      return null;
    }

    const payload: Record<string, string | number> = {
      orderId,
      paymentId: payment._id,
      reason: reason.trim() || "Admin initiated refund",
    };

    if (partialPaise.trim()) {
      const amount = Number.parseInt(partialPaise, 10);
      if (!Number.isInteger(amount) || amount <= 0 || amount > remainingPaise) {
        feedback.warning("Invalid amount", "Enter a partial refund in paise within the remaining balance.");
        return null;
      }
      payload.amount = amount;
    }

    await apiRequest("/api/v1/payments/refunds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    feedback.success(
      "Refund initiated",
      `Razorpay is processing the refund for ${payment.order?.orderNumber ?? "this order"}.`,
      `refund-${payment._id}`,
    );
    setReason("");
    setPartialPaise("");
    onCompleted?.();
    return null;
  });

  if (!canRefund) {
    return <span className="admin-muted-text">—</span>;
  }

  return (
    <details className="admin-refund-panel">
      <summary>Refund</summary>
      <div className="admin-refund-fields">
        <label htmlFor={reasonId}>
          Reason
          <input
            id={reasonId}
            value={reason}
            onChange={(event) => setReason(event.currentTarget.value)}
            maxLength={500}
            placeholder="Customer return, duplicate charge…"
          />
        </label>
        <label>
          Partial amount (paise, optional)
          <input
            inputMode="numeric"
            value={partialPaise}
            onChange={(event) => setPartialPaise(event.currentTarget.value.replace(/\D/g, ""))}
            placeholder={`Full refund: ${remainingPaise} paise`}
          />
        </label>
        <LoadingButton
          type="button"
          variant="destructive"
          loading={loading}
          loadingText="Submitting..."
          onClick={() => void submitRefund()}
        >
          Issue refund
        </LoadingButton>
      </div>
    </details>
  );
}
