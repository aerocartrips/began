import { ORDER_STATUS, STATUS_CHANGE_SOURCE } from "@/lib/constants/order-status";
import { assertFulfillmentTransition } from "@/lib/constants/order-transitions";
import { ApiError } from "@/lib/utils/api-error";

/**
 * @param {import("mongoose").Document} order
 * @param {{
 *   previousOrderStatus?: string;
 *   newOrderStatus?: string;
 *   previousPaymentStatus?: string;
 *   newPaymentStatus?: string;
 *   changedBy?: unknown;
 *   changedByLabel?: string;
 *   source?: string;
 *   remarks?: string;
 *   customerVisibleRemark?: string;
 * }} entry
 */
export function appendOrderStatusHistory(order, entry) {
  const previousOrderStatus = entry.previousOrderStatus ?? order.orderStatus;
  const newOrderStatus = entry.newOrderStatus ?? order.orderStatus;
  const previousPaymentStatus = entry.previousPaymentStatus ?? order.paymentStatus;
  const newPaymentStatus = entry.newPaymentStatus ?? order.paymentStatus;

  if (
    previousOrderStatus === newOrderStatus &&
    previousPaymentStatus === newPaymentStatus &&
    !entry.remarks &&
    !entry.customerVisibleRemark
  ) {
    return;
  }

  order.statusHistory.push({
    previousOrderStatus,
    newOrderStatus,
    previousPaymentStatus,
    newPaymentStatus,
    changedBy: entry.changedBy ?? null,
    changedByLabel: entry.changedByLabel ?? "",
    source: entry.source ?? STATUS_CHANGE_SOURCE.SYSTEM,
    remarks: entry.remarks ?? "",
    customerVisibleRemark: entry.customerVisibleRemark ?? "",
  });
}

/**
 * @param {import("mongoose").Document} order
 * @param {string} nextOrderStatus
 * @param {{
 *   actor?: unknown;
 *   actorLabel?: string;
 *   source?: string;
 *   remarks?: string;
 *   customerVisibleRemark?: string;
 * }} [meta]
 */
export function applyFulfillmentStatus(order, nextOrderStatus, meta = {}) {
  if (order.orderStatus === nextOrderStatus) return order;

  try {
    assertFulfillmentTransition(order.orderStatus, nextOrderStatus, order.paymentStatus);
  } catch (error) {
    throw new ApiError(422, error instanceof Error ? error.message : "Invalid status transition.");
  }

  const previousOrderStatus = order.orderStatus;
  order.orderStatus = nextOrderStatus;
  // The return window runs from the first delivery.
  if (nextOrderStatus === ORDER_STATUS.DELIVERED && !order.deliveredAt) order.deliveredAt = new Date();
  appendOrderStatusHistory(order, {
    previousOrderStatus,
    newOrderStatus: nextOrderStatus,
    previousPaymentStatus: order.paymentStatus,
    newPaymentStatus: order.paymentStatus,
    changedBy: meta.actor,
    changedByLabel: meta.actorLabel ?? "",
    source: meta.source ?? STATUS_CHANGE_SOURCE.ADMIN,
    remarks: meta.remarks ?? "",
    customerVisibleRemark: meta.customerVisibleRemark ?? "",
  });

  return order;
}

/**
 * @param {import("mongoose").Document} order
 * @param {string} nextPaymentStatus
 * @param {object} [meta]
 */
export function applyPaymentStatus(order, nextPaymentStatus, meta = {}) {
  if (order.paymentStatus === nextPaymentStatus) return order;
  const previousPaymentStatus = order.paymentStatus;
  order.paymentStatus = nextPaymentStatus;
  appendOrderStatusHistory(order, {
    previousOrderStatus: order.orderStatus,
    newOrderStatus: order.orderStatus,
    previousPaymentStatus,
    newPaymentStatus: nextPaymentStatus,
    changedBy: meta.actor,
    changedByLabel: meta.actorLabel ?? "",
    source: meta.source ?? STATUS_CHANGE_SOURCE.ADMIN,
    remarks: meta.remarks ?? "",
    customerVisibleRemark: meta.customerVisibleRemark ?? "",
  });
  return order;
}
