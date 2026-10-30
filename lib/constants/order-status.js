export const ORDER_STATUS = {
  PENDING: "pending",
  PENDING_PAYMENT: "pending_payment",
  CONFIRMED: "confirmed",
  PROCESSING: "processing",
  PACKED: "packed",
  SHIPPED: "shipped",
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  RETURN_REQUESTED: "return_requested",
  RETURNED: "returned",
};

export const PAYMENT_STATUS = {
  PENDING: "pending",
  PAID: "paid",
  FAILED: "failed",
  REFUNDED: "refunded",
  PARTIALLY_REFUNDED: "partially_refunded",
};

export const ORDER_STATUS_VALUES = Object.values(ORDER_STATUS);
export const PAYMENT_STATUS_VALUES = Object.values(PAYMENT_STATUS);

/** Customer-facing filter buckets mapped to query params. */
export const ORDER_FILTER_BUCKETS = {
  all: null,
  pending_payment: "pending_payment",
  confirmed: ORDER_STATUS.CONFIRMED,
  processing: ORDER_STATUS.PROCESSING,
  packed: ORDER_STATUS.PACKED,
  shipped: ORDER_STATUS.SHIPPED,
  out_for_delivery: ORDER_STATUS.OUT_FOR_DELIVERY,
  delivered: ORDER_STATUS.DELIVERED,
  cancelled: ORDER_STATUS.CANCELLED,
  returned: ORDER_STATUS.RETURNED,
};

export const RETURN_REQUEST_STATUS = {
  NONE: "none",
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

export const STATUS_CHANGE_SOURCE = {
  ADMIN: "admin",
  CUSTOMER: "customer",
  SYSTEM: "system",
  DELHIVERY: "delhivery",
  PAYMENT: "payment",
};
