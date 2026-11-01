import { Payment } from "@/lib/db/models/Payment";
import { Order } from "@/lib/db/models/Order";
import { getRazorpayClient } from "@/lib/razorpay/client";
import { assertRazorpayConfig } from "@/lib/razorpay/config";
import { verifyPaymentSignature } from "@/lib/razorpay/signature";
import { PAYMENT_RECORD_STATUS } from "@/lib/constants/payment-status";
import { ApiError } from "@/lib/utils/api-error";
import { finalizeCapturedOrder, markOrderPaymentFailed } from "@/lib/services/order.service";
import { onPaymentIssue } from "@/lib/notifications/events";

async function fetchAuthoritativePayment(paymentId) {
  const razorpay = getRazorpayClient();
  return razorpay.payments.fetch(paymentId);
}

/**
 * Idempotent payment capture reconciliation shared by verify API and webhooks.
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
    const order = await Order.findById(payment.order);
    return { payment, order, idempotent: true };
  }

  if (!skipSignature) {
    const { key_secret } = assertRazorpayConfig();
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
  await payment.save();

  const order = await Order.findById(payment.order);
  if (!order) throw new ApiError(404, "Order not found.");
  await finalizeCapturedOrder(order, { method: payment.method });

  return { payment, order, idempotent: false };
}

/** Called only for failures confirmed by Razorpay (payment.failed webhook). */
export async function reconcileFailedPayment({ razorpayOrderId, reason }) {
  const payment = await Payment.findOne({ razorpayOrderId });
  if (!payment) return null;
  if (payment.status === PAYMENT_RECORD_STATUS.CAPTURED) return payment;

  payment.status = PAYMENT_RECORD_STATUS.FAILED;
  payment.failedAt = new Date();
  payment.failureReason = reason || "Payment failed.";
  await payment.save();

  const order = await Order.findById(payment.order);
  if (order) await markOrderPaymentFailed(order, payment.failureReason);
  return payment;
}
