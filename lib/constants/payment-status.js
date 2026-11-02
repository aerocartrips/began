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


/** All stores sell in Indian rupees. */
export const CHECKOUT_CURRENCY = "INR";
