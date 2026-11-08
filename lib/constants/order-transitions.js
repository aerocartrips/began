import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants/order-status";

/** Allowed fulfillment transitions (admin/system). */
export const FULFILLMENT_TRANSITIONS = {
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PENDING_PAYMENT]: [ORDER_STATUS.CANCELLED, ORDER_STATUS.CONFIRMED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.PACKED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PACKED]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.OUT_FOR_DELIVERY]: [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]: [ORDER_STATUS.RETURN_REQUESTED],
  [ORDER_STATUS.RETURN_REQUESTED]: [ORDER_STATUS.RETURNED, ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.RETURNED]: [],
  [ORDER_STATUS.CANCELLED]: [],
};

/**
 * Payment changes an admin may record by hand: marking an unpaid order paid
 * (an offline payment). Everything else follows Razorpay: captures and
 * failures arrive from the provider, refunds are issued through the refund flow.
 */
export const MANUAL_PAYMENT_TRANSITIONS = {
  [PAYMENT_STATUS.PENDING]: [PAYMENT_STATUS.PAID],
};

/**
 * @param {string} currentStatus
 * @param {string} nextStatus
 * @param {string} paymentStatus
 */
export function assertFulfillmentTransition(currentStatus, nextStatus, paymentStatus) {
  if (currentStatus === nextStatus) return;

  const allowed = FULFILLMENT_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw new Error(`Invalid status transition from ${currentStatus} to ${nextStatus}.`);
  }

  const requiresPaid = [
    ORDER_STATUS.PROCESSING,
    ORDER_STATUS.PACKED,
    ORDER_STATUS.SHIPPED,
    ORDER_STATUS.OUT_FOR_DELIVERY,
    ORDER_STATUS.DELIVERED,
  ];

  // A partial refund (e.g. a damaged piece) does not stop the rest of the order.
  const captured = paymentStatus === PAYMENT_STATUS.PAID || paymentStatus === PAYMENT_STATUS.PARTIALLY_REFUNDED;
  if (requiresPaid.includes(nextStatus) && !captured) {
    throw new Error("Fulfillment cannot advance before payment is captured.");
  }
}

/**
 * @param {string} orderStatus
 * @param {string} paymentStatus
 */
export function canCustomerCancel(orderStatus, paymentStatus) {
  if (orderStatus === ORDER_STATUS.CANCELLED) return false;
  if ([ORDER_STATUS.SHIPPED, ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.DELIVERED].includes(orderStatus)) {
    return false;
  }
  if (orderStatus === ORDER_STATUS.PENDING_PAYMENT || paymentStatus === PAYMENT_STATUS.PENDING) {
    return true;
  }
  if (orderStatus === ORDER_STATUS.CONFIRMED && paymentStatus === PAYMENT_STATUS.PAID) {
    return true;
  }
  return false;
}

/**
 * @param {string} orderStatus
 */
export function canCustomerRequestReturn(orderStatus) {
  return orderStatus === ORDER_STATUS.DELIVERED;
}
