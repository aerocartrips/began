import { ORDER_STATUS, PAYMENT_STATUS, RETURN_REQUEST_STATUS } from "@/lib/constants/order-status";
import { canCustomerCancel, canCustomerRequestReturn } from "@/lib/constants/order-transitions";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * When the order was delivered: `deliveredAt`, or for orders delivered before
 * that field existed, the delivery entry of the status history.
 * @param {{ deliveredAt?: Date | string | null, statusHistory?: { newOrderStatus?: string, createdAt?: Date | string }[] }} order
 * @returns {Date | null}
 */
export function deliveredAtOf(order) {
  if (order.deliveredAt) return new Date(order.deliveredAt);
  const entry = order.statusHistory?.find((item) => item.newOrderStatus === ORDER_STATUS.DELIVERED);
  return entry?.createdAt ? new Date(entry.createdAt) : null;
}

/**
 * What the customer can still do with an order, under the store's published
 * windows (StoreSettings.orders): cancel a paid order within
 * `cancellationWindowHours` of placing it (unpaid orders any time before
 * payment), and request a return within `returnWindowDays` of delivery.
 * The same rules are enforced by the API and shown on the order page.
 * @param {Record<string, any>} order
 * @param {{ cancellationWindowHours: number, returnWindowDays: number }} windows
 * @param {Date} [now]
 */
export function customerOrderActions(order, windows, now = new Date()) {
  const paid = order.paymentStatus === PAYMENT_STATUS.PAID;
  const cancelUntil = paid ? new Date(new Date(order.createdAt).getTime() + windows.cancellationWindowHours * HOUR_MS) : null;
  const canCancel = canCustomerCancel(order.orderStatus, order.paymentStatus) && (!cancelUntil || now <= cancelUntil);

  const deliveredAt = canCustomerRequestReturn(order.orderStatus) ? deliveredAtOf(order) : null;
  const returnUntil = deliveredAt ? new Date(deliveredAt.getTime() + windows.returnWindowDays * DAY_MS) : null;
  const canRequestReturn =
    Boolean(returnUntil) && now <= returnUntil && order.returnRequest?.status !== RETURN_REQUEST_STATUS.PENDING;

  // Unpaid and still inside the payment window: a payment may yet be confirmed.
  const awaitingPayment =
    order.orderStatus === ORDER_STATUS.PENDING_PAYMENT &&
    order.paymentStatus === PAYMENT_STATUS.PENDING &&
    Boolean(order.paymentExpiresAt) &&
    now < new Date(order.paymentExpiresAt);

  return {
    canCancel,
    cancelUntil: canCancel ? cancelUntil : null,
    canRequestReturn,
    returnUntil: canRequestReturn ? returnUntil : null,
    awaitingPayment,
  };
}

/**
 * Why `action` is not available, for the API error.
 * @param {"cancel" | "return"} action
 * @param {Record<string, any>} order
 */
export function unavailableActionMessage(action, order) {
  if (action === "cancel") {
    return canCustomerCancel(order.orderStatus, order.paymentStatus)
      ? "The cancellation window for this order has closed. Contact us if you need help."
      : "This order can't be cancelled at its current stage.";
  }
  if (!canCustomerRequestReturn(order.orderStatus)) return "Returns can only be requested for delivered orders.";
  if (order.returnRequest?.status === RETURN_REQUEST_STATUS.PENDING) return "A return request is already pending review.";
  return "The return window for this order has closed. Contact us if you need help.";
}
