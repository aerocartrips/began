import mongoose from "mongoose";
import {
  ORDER_STATUS,
  PAYMENT_STATUS,
  RETURN_REQUEST_STATUS,
  STATUS_CHANGE_SOURCE,
} from "@/lib/constants/order-status";
import { canCustomerCancel, canCustomerRequestReturn } from "@/lib/constants/order-transitions";
import { Payment } from "@/lib/db/models/Payment";
import { ApiError } from "@/lib/utils/api-error";
import { orderRepository } from "@/lib/repositories/order.repository";
import { releaseInventoryForOrder } from "@/lib/services/order.service";
import { applyFulfillmentStatus } from "@/lib/services/order-status.service";
import { reconcileOrderPayment } from "@/lib/services/order-payment-refresh.service";
import { cancelOrderSchema, returnRequestSchema } from "@/lib/validators/order.validator";
import { formatZodErrors } from "@/lib/validators/auth.validator";

export async function cancelCustomerOrder(orderId, user, payload) {
  const parsed = cancelOrderSchema.safeParse(payload ?? {});
  if (!parsed.success) {
    throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  }

  const order = await orderRepository.findById(orderId);
  if (!order) throw new ApiError(404, "Order not found.");
  if (String(order.customer._id ?? order.customer) !== String(user._id)) {
    throw new ApiError(403, "You do not have access to this order.");
  }

  if (!canCustomerCancel(order.orderStatus, order.paymentStatus)) {
    throw new ApiError(409, "This order cannot be cancelled at its current stage.");
  }

  if (order.orderStatus === ORDER_STATUS.CANCELLED) {
    return { order, refund: { status: order.cancellationRefund?.status ?? "none" } };
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    if (order.inventoryReserved) {
      await releaseInventoryForOrder(order, session);
      order.inventoryReserved = false;
    }

    applyFulfillmentStatus(order, ORDER_STATUS.CANCELLED, {
      actor: user._id,
      actorLabel: user.email ?? user.name ?? "customer",
      source: STATUS_CHANGE_SOURCE.CUSTOMER,
      remarks: parsed.data.reason,
      customerVisibleRemark: "Order cancelled by customer.",
    });

    if (order.paymentStatus === PAYMENT_STATUS.PENDING) {
      order.paymentStatus = PAYMENT_STATUS.FAILED;
    }

    order.cancellation = {
      reason: parsed.data.reason,
      cancelledAt: new Date(),
      cancelledBy: user._id,
    };

    await order.save({ session });
    await session.commitTransaction();

    const { upsertCancellationRequest } = await import("@/lib/services/service-request.service");
    await upsertCancellationRequest(order, user, parsed.data.reason);

    let refundOutcome = { status: "none" };
    if (order.paymentStatus === PAYMENT_STATUS.PAID) {
      const { initiateCustomerCancellationRefund } = await import("@/lib/services/refund.service");
      refundOutcome = await initiateCustomerCancellationRefund(order, user);
    }

    return { order, refund: refundOutcome };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function createCustomerReturnRequest(orderId, user, payload) {
  const parsed = returnRequestSchema.safeParse(payload ?? {});
  if (!parsed.success) {
    throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  }

  const order = await orderRepository.findById(orderId);
  if (!order) throw new ApiError(404, "Order not found.");
  if (String(order.customer._id ?? order.customer) !== String(user._id)) {
    throw new ApiError(403, "You do not have access to this order.");
  }

  if (!canCustomerRequestReturn(order.orderStatus)) {
    throw new ApiError(409, "Returns can only be requested for delivered orders.");
  }

  if (order.returnRequest?.status === RETURN_REQUEST_STATUS.PENDING) {
    throw new ApiError(409, "A return request is already pending review.");
  }

  order.returnRequest = {
    status: RETURN_REQUEST_STATUS.PENDING,
    reason: parsed.data.reason,
    remarks: parsed.data.remarks ?? "",
    requestedAt: new Date(),
  };

  applyFulfillmentStatus(order, ORDER_STATUS.RETURN_REQUESTED, {
    actor: user._id,
    actorLabel: user.email ?? user.name ?? "customer",
    source: STATUS_CHANGE_SOURCE.CUSTOMER,
    remarks: parsed.data.remarks ?? "",
    customerVisibleRemark: "Return request submitted for review.",
  });

  await order.save();

  const { upsertReturnRequest } = await import("@/lib/services/service-request.service");
  await upsertReturnRequest(order, user, {
    reason: parsed.data.reason,
    remarks: parsed.data.remarks ?? "",
  });

  return order;
}

export async function refreshCustomerOrderPayment(orderId, user) {
  const order = await orderRepository.findById(orderId);
  if (!order) throw new ApiError(404, "Order not found.");
  if (String(order.customer._id ?? order.customer) !== String(user._id)) {
    throw new ApiError(403, "You do not have access to this order.");
  }

  return reconcileOrderPayment(order);
}

export async function getOrderPaymentSummary(orderId) {
  return Payment.findOne({ order: orderId })
    .sort({ createdAt: -1 })
    .select(
      "razorpayPaymentId razorpayOrderId amount currency status method capturedAt failedAt refundStatus refundedAmount",
    );
}

export async function getOrderTracking(order, { refresh = false } = {}) {
  const awb = order.shipment?.awb;
  if (!awb) {
    throw new ApiError(404, "Shipment tracking is not available for this order yet.");
  }

  const { fetchDelhiveryTracking, DELHIVERY_TRACKING_CACHE_MS } = await import(
    "@/lib/delhivery/tracking"
  );

  const cached = !refresh ? order.shipment?.trackingCache : null;
  const tracking = await fetchDelhiveryTracking(awb, {
    fetchedAt: order.shipment?.trackingFetchedAt,
    cache: cached,
  });

  if (!tracking.cached) {
    order.shipment.status = tracking.status || order.shipment.status;
    if (tracking.estimatedDelivery) {
      order.shipment.estimatedDelivery = new Date(tracking.estimatedDelivery);
    }
    order.shipment.trackingFetchedAt = new Date();
    order.shipment.trackingCache = tracking;
    await order.save();
  }

  return tracking;
}
