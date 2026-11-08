import { Payment } from "@/lib/db/models/Payment";
import { getRazorpayClient } from "@/lib/razorpay/client";
import { assertRazorpayConfig } from "@/lib/razorpay/config";
import { verifyPaymentSignature } from "@/lib/razorpay/signature";
import { PAYMENT_RECORD_STATUS } from "@/lib/constants/payment-status";
import { ApiError } from "@/lib/utils/api-error";
import { confirmOrderPayment } from "@/lib/services/order-lifecycle.service";
import { onPaymentIssue } from "@/lib/notifications/events";

async function fetchAuthoritativePayment(paymentId) {
  const razorpay = await getRazorpayClient();
  return razorpay.payments.fetch(paymentId);
}

/**
 * Every payment Razorpay holds for one of its orders, including attempts the
 * shopper's browser never reported back (closed tab, UPI approved later).
 * @param {string} razorpayOrderId
 * @returns {Promise<{ captured: Record<string, any> | null, authorized: Record<string, any> | null }>}
 */
export async function fetchRazorpayOrderPayments(razorpayOrderId) {
  const razorpay = await getRazorpayClient();
  const { items = [] } = await razorpay.orders.fetchPayments(razorpayOrderId);
  return {
    captured: items.find((payment) => payment.status === "captured") ?? null,
    authorized: items.find((payment) => payment.status === "authorized") ?? null,
  };
}

/**
 * Idempotent capture reconciliation shared by the verify API, webhooks and the
 * payment-expiry job: checks the payment with Razorpay (order, amount, currency,
 * captured), records it, then confirms the order through the order lifecycle.
 */
export async function reconcileCapturedPayment({
  userId,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  skipSignature = false,
}) {
  const paymentQuery = { razorpayOrderId };
  if (userId) paymentQuery.user = userId;

  const payment = await Payment.findOne(paymentQuery);
  if (!payment) {
    throw new ApiError(404, "Payment record not found.");
  }

  if (payment.status === PAYMENT_RECORD_STATUS.CAPTURED && payment.razorpayPaymentId) {
    // Already recorded. Confirming again is a no-op for a paid order and
    // completes one whose earlier confirmation was interrupted.
    const { order } = await confirmOrderPayment(payment.order, { method: payment.method, razorpayOrderId });
    return { payment, order, idempotent: true };
  }

  if (!skipSignature) {
    const { key_secret } = await assertRazorpayConfig();
    verifyPaymentSignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
      secret: key_secret,
    });
  }

  if (payment.razorpayOrderId !== razorpayOrderId) {
    throw new ApiError(400, "Razorpay order mismatch.");
  }

  const authoritative = await fetchAuthoritativePayment(razorpayPaymentId);
  const mismatch =
    authoritative.order_id !== razorpayOrderId
      ? "Payment does not belong to the expected Razorpay order."
      : Number(authoritative.amount) !== Number(payment.amount)
        ? "Paid amount does not match the order total."
        : String(authoritative.currency).toUpperCase() !== String(payment.currency).toUpperCase()
          ? "Payment currency mismatch."
          : null;
  if (mismatch) {
    onPaymentIssue({ razorpayOrderId, razorpayPaymentId, orderId: payment.order, reason: mismatch });
    throw new ApiError(400, mismatch);
  }
  if (authoritative.status !== "captured") {
    throw new ApiError(409, "Payment is not captured yet.");
  }

  payment.razorpayPaymentId = razorpayPaymentId;
  payment.status = PAYMENT_RECORD_STATUS.CAPTURED;
  payment.method = authoritative.method || payment.method;
  payment.capturedAt = new Date();
  payment.failureReason = "";
  await payment.save();

  const { order } = await confirmOrderPayment(payment.order, { method: payment.method, razorpayOrderId });
  return { payment, order, idempotent: false };
}

/**
 * A payment attempt failed (payment.failed webhook). Only the attempt is
 * recorded: Razorpay lets the shopper retry on the same order until the store's
 * reservation window ends, so the order keeps its stock and stays payable. The
 * payment-expiry job cancels it if no attempt succeeds in time.
 */
export async function recordFailedPaymentAttempt({ razorpayOrderId, reason }) {
  const payment = await Payment.findOne({ razorpayOrderId });
  if (!payment || payment.status === PAYMENT_RECORD_STATUS.CAPTURED) return payment;

  payment.status = PAYMENT_RECORD_STATUS.FAILED;
  payment.failedAt = new Date();
  payment.failureReason = reason || "Payment failed.";
  await payment.save();
  return payment;
}
