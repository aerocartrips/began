import { Payment } from "@/lib/db/models/Payment";
import { ApiError } from "@/lib/utils/api-error";
import { isRazorpayConfigured } from "@/lib/razorpay/config";
import { PAYMENT_RECORD_STATUS } from "@/lib/constants/payment-status";
import { confirmOrderPayment } from "@/lib/services/order-lifecycle.service";
import {
  fetchRazorpayOrderPayments,
  reconcileCapturedPayment,
} from "@/lib/services/payment-verification.service";

/**
 * @typedef {"paid" | "authorized" | "unpaid" | "no_payment"} PaymentState
 * - paid: a captured payment exists and the order is confirmed;
 * - authorized: the bank approved a payment that Razorpay has not captured yet;
 * - unpaid: Razorpay holds no successful payment for the order;
 * - no_payment: the payment was never started (no Razorpay order).
 */

/**
 * Asks Razorpay what happened to an order's payment and confirms the order if
 * it was captured. It looks the payment up by Razorpay order, not by the
 * payment id the browser reported, so it also finds payments completed after
 * the shopper closed the page.
 * @param {import("mongoose").Document & Record<string, any>} order
 * @returns {Promise<{ order: any, payment: any, state: PaymentState, refreshed: boolean }>}
 */
export async function reconcileOrderPayment(order) {
  const payment = await Payment.findOne({ order: order._id, razorpayOrderId: { $type: "string" } }).sort({ createdAt: -1 });
  if (!payment) return { order, payment: null, state: "no_payment", refreshed: false };

  if (payment.status === PAYMENT_RECORD_STATUS.CAPTURED && payment.razorpayPaymentId) {
    const confirmed = await confirmOrderPayment(order._id, { method: payment.method || "razorpay" });
    return { order: confirmed.order, payment, state: "paid", refreshed: false };
  }

  if (!(await isRazorpayConfigured())) {
    throw new ApiError(503, "Payment status can't be checked right now because online payments are not configured.");
  }

  const remote = await fetchRazorpayOrderPayments(payment.razorpayOrderId);
  if (remote.captured) {
    const result = await reconcileCapturedPayment({
      razorpayOrderId: payment.razorpayOrderId,
      razorpayPaymentId: remote.captured.id,
      skipSignature: true,
    });
    return { order: result.order, payment: result.payment, state: "paid", refreshed: true };
  }
  return { order, payment, state: remote.authorized ? "authorized" : "unpaid", refreshed: true };
}
