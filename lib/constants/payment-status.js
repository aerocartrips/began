export const PAYMENT_RECORD_STATUS = {
  CREATED: "created",
  AUTHORIZED: "authorized",
  CAPTURED: "captured",
  FAILED: "failed",
  PARTIALLY_REFUNDED: "partially_refunded",
  REFUNDED: "refunded",
};

export const PAYMENT_RECORD_STATUS_VALUES = Object.values(PAYMENT_RECORD_STATUS);

export const REFUND_STATUS = {
  NONE: "none",
  PENDING: "pending",
  PROCESSED: "processed",
  FAILED: "failed",
};

export const WEBHOOK_PROCESSING_STATUS = {
  RECEIVED: "received",
  PROCESSED: "processed",
  IGNORED: "ignored",
  FAILED: "failed",
};

export const PAYMENT_RESERVATION_MINUTES = Number(process.env.PAYMENT_RESERVATION_MINUTES ?? 30);

export const CHECKOUT_CURRENCY = process.env.CHECKOUT_CURRENCY?.trim() || "INR";
