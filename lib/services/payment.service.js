import { Payment } from "@/lib/db/models/Payment";
import { getRazorpayClient } from "@/lib/razorpay/client";
import { getPublicRazorpayKeyId, isRazorpayConfigured } from "@/lib/razorpay/config";
import { PAYMENT_RECORD_STATUS } from "@/lib/constants/payment-status";
import { ApiError } from "@/lib/utils/api-error";
import { createPendingPaymentOrder } from "@/lib/services/order.service";
import { buildPaginationMeta, parsePagination } from "@/lib/utils/pagination";

export async function createCheckoutPaymentOrder(user, payload) {
  if (!isRazorpayConfigured()) {
    throw new ApiError(503, "Razorpay checkout is not configured.");
  }

  const order = await createPendingPaymentOrder(user, payload);
  const razorpay = getRazorpayClient();
  const razorpayOrder = await razorpay.orders.create({
    amount: order.amountPaise,
    currency: order.currency,
    receipt: order.orderNumber,
    notes: {
      internalOrderId: String(order._id),
      orderNumber: order.orderNumber,
    },
  });

  await Payment.create({
    order: order._id,
    user: user._id,
    razorpayOrderId: razorpayOrder.id,
    amount: order.amountPaise,
    currency: order.currency,
    status: PAYMENT_RECORD_STATUS.CREATED,
    receipt: order.orderNumber,
    metadata: { orderNumber: order.orderNumber },
  });

  return {
    key: getPublicRazorpayKeyId(),
    razorpayOrderId: razorpayOrder.id,
    amount: order.amountPaise,
    currency: order.currency,
    internalOrderId: String(order._id),
    orderNumber: order.orderNumber,
  };
}

export async function getPaymentForUser(paymentId, user, isAdmin) {
  const payment = await Payment.findById(paymentId).populate("order").populate("user", "name email");
  if (!payment) throw new ApiError(404, "Payment not found.");
  if (!isAdmin && String(payment.user._id ?? payment.user) !== String(user._id)) {
    throw new ApiError(403, "You do not have access to this payment.");
  }
  return payment;
}

export async function listPayments(searchParams) {
  const { page, limit, skip } = parsePagination(searchParams);
  const filter = {};
  const status = searchParams.get("status");
  if (status) filter.status = status;

  const [items, total] = await Promise.all([
    Payment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("order", "orderNumber totalAmount paymentStatus orderStatus")
      .populate("user", "name email companyName"),
    Payment.countDocuments(filter),
  ]);

  return { items, meta: buildPaginationMeta(total, page, limit) };
}
