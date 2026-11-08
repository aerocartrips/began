import mongoose from "mongoose";
import {
  ORDER_STATUS,
  PAYMENT_STATUS,
  RETURN_REQUEST_STATUS,
  STATUS_CHANGE_SOURCE,
} from "@/lib/constants/order-status";
import { Order } from "@/lib/db/models/Order";
import { Payment } from "@/lib/db/models/Payment";
import { getStoreSettingsDocument } from "@/lib/db/models/StoreSettings";
import { withTransaction } from "@/lib/db/transaction";
import { ApiError } from "@/lib/utils/api-error";
import { orderRepository } from "@/lib/repositories/order.repository";
import { applyFulfillmentStatus } from "@/lib/services/order-status.service";
import { cancelOrderForCustomer } from "@/lib/services/order-lifecycle.service";
import { customerOrderActions, unavailableActionMessage } from "@/lib/services/order-policy";
import { reconcileOrderPayment } from "@/lib/services/order-payment-refresh.service";
import { cancelOrderSchema, returnRequestSchema } from "@/lib/validators/order.validator";
import { formatZodErrors } from "@/lib/validators/auth.validator";
import { onCustomerCancellation, onReturnRequested, onTrackingUpdated } from "@/lib/notifications/events";

function parse(schema, payload) {
  const parsed = schema.safeParse(payload ?? {});
  if (!parsed.success) throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  return parsed.data;
}

/** @param {Record<string, any>} order @param {Record<string, any>} user */
function assertOwnOrder(order, user) {
  if (String(order.customer?._id ?? order.customer) !== String(user._id)) {
    throw new ApiError(403, "You do not have access to this order.");
  }
}

/**
 * Customer cancellation, allowed before dispatch and, for a paid order, within
 * the store's cancellation window. A paid order is refunded in full and opened
 * as a cancellation request for the team; unpaid orders just release their stock.
 */
export async function cancelCustomerOrder(orderId, user, payload) {
  const { reason } = parse(cancelOrderSchema, payload);
  if (!mongoose.isValidObjectId(orderId)) throw new ApiError(404, "Order not found.");
  const { orders: windows } = await getStoreSettingsDocument();

  const { order, cancelled, refund } = await cancelOrderForCustomer(orderId, user, {
    reason,
    assert: (current) => {
      assertOwnOrder(current, user);
      if (current.orderStatus === ORDER_STATUS.CANCELLED) return;
      if (!customerOrderActions(current, windows).canCancel) {
        throw new ApiError(409, unavailableActionMessage("cancel", current));
      }
    },
  });

  if (cancelled && order.paymentStatus === PAYMENT_STATUS.PAID) {
    const { upsertCancellationRequest } = await import("@/lib/services/service-request.service");
    const request = await upsertCancellationRequest(order, user, reason);
    onCustomerCancellation(order, { requestId: request?._id, reason, paid: true });
  }
  return { order, refund };
}

/** Return request for a delivered order, within the store's return window. */
export async function createCustomerReturnRequest(orderId, user, payload) {
  const { reason, remarks = "" } = parse(returnRequestSchema, payload);
  if (!mongoose.isValidObjectId(orderId)) throw new ApiError(404, "Order not found.");
  const { orders: windows } = await getStoreSettingsDocument();

  const order = await withTransaction(async (session) => {
    const current = await Order.findById(orderId).session(session);
    if (!current) throw new ApiError(404, "Order not found.");
    assertOwnOrder(current, user);
    if (!customerOrderActions(current, windows).canRequestReturn) {
      throw new ApiError(409, unavailableActionMessage("return", current));
    }

    current.returnRequest = {
      status: RETURN_REQUEST_STATUS.PENDING,
      reason,
      remarks,
      requestedAt: new Date(),
    };
    applyFulfillmentStatus(current, ORDER_STATUS.RETURN_REQUESTED, {
      actor: user._id,
      actorLabel: user.email ?? user.name ?? "customer",
      source: STATUS_CHANGE_SOURCE.CUSTOMER,
      remarks,
      customerVisibleRemark: "Return request submitted for review.",
    });
    await current.save({ session });
    return current;
  });

  const { upsertReturnRequest } = await import("@/lib/services/service-request.service");
  const request = await upsertReturnRequest(order, user, { reason, remarks });
  onReturnRequested(order, { requestId: request?._id, reason });

  return order;
}

/** "Refresh payment status" on the order page: asks Razorpay and confirms the order if it was paid. */
export async function refreshCustomerOrderPayment(orderId, user) {
  const order = await orderRepository.findById(orderId);
  if (!order) throw new ApiError(404, "Order not found.");
  assertOwnOrder(order, user);
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
    const previousCarrierStatus = order.shipment.status;
    order.shipment.status = tracking.status || order.shipment.status;
    if (tracking.estimatedDelivery) {
      order.shipment.estimatedDelivery = new Date(tracking.estimatedDelivery);
    }
    order.shipment.trackingFetchedAt = new Date();
    order.shipment.trackingCache = tracking;
    await order.save();
    onTrackingUpdated(order, previousCarrierStatus);
  }

  return tracking;
}
