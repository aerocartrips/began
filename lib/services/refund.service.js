import mongoose from "mongoose";
import { Payment } from "@/lib/db/models/Payment";
import { getRazorpayClient } from "@/lib/razorpay/client";
import { PAYMENT_RECORD_STATUS, REFUND_STATUS } from "@/lib/constants/payment-status";
import { PAYMENT_STATUS } from "@/lib/constants/order-status";
import { ApiError } from "@/lib/utils/api-error";
import { formatZodErrors } from "@/lib/validators/auth.validator";
import { createRefundSchema } from "@/lib/validators/payment.validator";
import { Order } from "@/lib/db/models/Order";
import { onRefundInitiated, onRefundSettled, onRefundStartFailed } from "@/lib/notifications/events";

export async function createAdminRefund(adminUser, payload) {
  const parsed = createRefundSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  }

  if (!mongoose.isValidObjectId(parsed.data.orderId)) {
    throw new ApiError(404, "Order not found.");
  }

  const order = await Order.findById(parsed.data.orderId);
  if (!order) throw new ApiError(404, "Order not found.");

  const payment = parsed.data.paymentId
    ? await Payment.findById(parsed.data.paymentId)
    : await Payment.findOne({ order: order._id, status: PAYMENT_RECORD_STATUS.CAPTURED });

  if (!payment || String(payment.order) !== String(order._id)) {
    throw new ApiError(404, "Captured payment not found for this order.");
  }

  const remainingRefundable = payment.amount - payment.refundedAmount;
  const refundAmount = parsed.data.amount ?? remainingRefundable;
  if (!Number.isInteger(refundAmount) || refundAmount <= 0 || refundAmount > remainingRefundable) {
    throw new ApiError(422, "Validation failed.", [
      { field: "amount", message: "Refund amount exceeds the remaining refundable balance." },
    ]);
  }

  const duplicatePending = payment.refunds.find((entry) => entry.status === REFUND_STATUS.PENDING);
  if (duplicatePending) {
    throw new ApiError(409, "A refund is already in progress for this payment.");
  }

  const razorpay = await getRazorpayClient();
  const refund = await razorpay.payments.refund(payment.razorpayPaymentId, {
    amount: refundAmount,
    notes: {
      reason: parsed.data.reason || "Admin initiated refund",
      adminUserId: String(adminUser._id),
    },
  });

  payment.refunds.push({
    razorpayRefundId: refund.id,
    amount: refundAmount,
    status: REFUND_STATUS.PENDING,
    reason: parsed.data.reason || "",
    adminUser: adminUser._id,
  });
  payment.refundStatus = REFUND_STATUS.PENDING;
  await payment.save();
  onRefundInitiated({
    orderId: order._id,
    orderNumber: order.orderNumber,
    customerId: order.customer,
    refundId: refund.id,
    amountPaise: refundAmount,
  });
  return { payment, refund };
}

/**
 * Initiate full refund when a paid order is cancelled by the customer (pre-shipment).
 * @param {import("mongoose").Document} order
 * @param {import("mongoose").Document} user
 */
export async function initiateCustomerCancellationRefund(order, user) {
  if (order.paymentStatus !== PAYMENT_STATUS.PAID) {
    return { status: "none", message: "No payment refund required." };
  }

  const payment = await Payment.findOne({
    order: order._id,
    status: PAYMENT_RECORD_STATUS.CAPTURED,
  });

  if (!payment) {
    order.cancellationRefund = {
      status: "manual_review",
      message: "Payment record not found. Our team will review your refund.",
      updatedAt: new Date(),
    };
    await order.save();
    onRefundStartFailed(order, "Cancelled paid order has no captured payment record. Review the refund manually.");
    return { status: "manual_review" };
  }

  const remainingRefundable = payment.amount - payment.refundedAmount;
  if (remainingRefundable <= 0) {
    return { status: "completed", message: "Payment already refunded." };
  }

  const duplicatePending = payment.refunds.find((entry) => entry.status === REFUND_STATUS.PENDING);
  if (duplicatePending) {
    order.cancellationRefund = {
      status: "processing",
      razorpayRefundId: duplicatePending.razorpayRefundId,
      updatedAt: new Date(),
      message: "Refund is already processing.",
    };
    await order.save();
    return { status: "processing" };
  }

  try {
    const razorpay = await getRazorpayClient();
    const refund = await razorpay.payments.refund(payment.razorpayPaymentId, {
      amount: remainingRefundable,
      notes: {
        reason: "Customer order cancellation",
        orderId: String(order._id),
        customerId: String(user._id),
      },
    });

    payment.refunds.push({
      razorpayRefundId: refund.id,
      amount: remainingRefundable,
      status: REFUND_STATUS.PENDING,
      reason: "Customer order cancellation",
    });
    payment.refundStatus = REFUND_STATUS.PENDING;
    await payment.save();

    order.cancellationRefund = {
      status: "pending",
      razorpayRefundId: refund.id,
      updatedAt: new Date(),
      message: "Refund initiated. Confirmation may take a few business days.",
    };
    await order.save();
    onRefundInitiated({
      orderId: order._id,
      orderNumber: order.orderNumber,
      customerId: user._id,
      refundId: refund.id,
      amountPaise: remainingRefundable,
    });

    return { status: "pending", razorpayRefundId: refund.id };
  } catch {
    order.cancellationRefund = {
      status: "failed",
      updatedAt: new Date(),
      message: "Automatic refund could not be started. Support will review manually.",
    };
    await order.save();
    onRefundStartFailed(order, "Automatic cancellation refund could not be started with Razorpay. Issue it manually.");
    return { status: "failed" };
  }
}

export async function processRefundWebhook(refundEntity, eventType) {
  const payment = await Payment.findOne({ razorpayPaymentId: refundEntity.payment_id });
  if (!payment) return null;

  const entry = payment.refunds.find((item) => item.razorpayRefundId === refundEntity.id);
  if (!entry) return payment;
  // A refund reaches a final state once; replays (e.g. a re-sent event with a new id) must not double-count.
  if (entry.status === REFUND_STATUS.PROCESSED || entry.status === REFUND_STATUS.FAILED) return payment;

  if (eventType === "refund.processed") {
    entry.status = REFUND_STATUS.PROCESSED;
    entry.processedAt = new Date();
    payment.refundedAmount += entry.amount;
    payment.refundStatus =
      payment.refundedAmount >= payment.amount ? REFUND_STATUS.PROCESSED : REFUND_STATUS.PENDING;
    payment.status =
      payment.refundedAmount >= payment.amount
        ? PAYMENT_RECORD_STATUS.REFUNDED
        : PAYMENT_RECORD_STATUS.PARTIALLY_REFUNDED;

    const order = await Order.findById(payment.order);
    if (order) {
      order.paymentStatus =
        payment.refundedAmount >= payment.amount
          ? PAYMENT_STATUS.REFUNDED
          : PAYMENT_STATUS.PARTIALLY_REFUNDED;
      if (order.cancellationRefund?.status === "pending" || order.cancellationRefund?.status === "processing") {
        order.cancellationRefund.status =
          payment.refundedAmount >= payment.amount ? "completed" : "processing";
        order.cancellationRefund.updatedAt = new Date();
        order.cancellationRefund.message = "Refund confirmed by payment provider.";
      }
      await order.save();
    }
  } else if (eventType === "refund.failed") {
    entry.status = REFUND_STATUS.FAILED;
    entry.processedAt = new Date();
    payment.refundStatus = REFUND_STATUS.FAILED;
  }

  await payment.save();
  if (eventType === "refund.processed" || eventType === "refund.failed") {
    onRefundSettled({
      orderId: payment.order,
      orderNumber: payment.receipt || payment.metadata?.orderNumber || "",
      customerId: payment.user,
      refundId: entry.razorpayRefundId,
      amountPaise: entry.amount,
      succeeded: eventType === "refund.processed",
    });
  }
  return payment;
}
