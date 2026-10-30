import { Payment } from "@/lib/db/models/Payment";
import { ApiError } from "@/lib/utils/api-error";
import { finalizeCapturedOrder } from "@/lib/services/order.service";
import { getRazorpayClient } from "@/lib/razorpay/client";
import { isRazorpayConfigured } from "@/lib/razorpay/config";
import { PAYMENT_RECORD_STATUS } from "@/lib/constants/payment-status";
import { reconcileCapturedPayment } from "@/lib/services/payment-verification.service";

export async function reconcileOrderPayment(order) {
  const payment = await Payment.findOne({ order: order._id }).sort({ createdAt: -1 });
  if (!payment) {
    throw new ApiError(404, "No payment record exists for this order.");
  }

  if (payment.status === PAYMENT_RECORD_STATUS.CAPTURED && payment.razorpayPaymentId) {
    const finalized = await finalizeCapturedOrder(order, { method: payment.method || "razorpay" });
    return { order: finalized.order, payment, refreshed: false, idempotent: true };
  }

  if (!isRazorpayConfigured() || !payment.razorpayPaymentId) {
    return { order, payment, refreshed: false, pending: true };
  }

  const razorpay = getRazorpayClient();
  const remote = await razorpay.payments.fetch(payment.razorpayPaymentId);

  if (remote.status === "captured") {
    const result = await reconcileCapturedPayment({
      razorpayOrderId: payment.razorpayOrderId,
      razorpayPaymentId: payment.razorpayPaymentId,
      skipSignature: true,
    });
    return { ...result, refreshed: true };
  }

  return { order, payment, refreshed: true, pending: remote.status !== "failed" };
}
