export const NOTIFICATION_RECIPIENT = {
  CUSTOMER: "customer",
  ADMIN: "admin",
};

export const NOTIFICATION_TYPE = {
  // Customer: orders and payments
  PAYMENT_SUCCEEDED: "payment_succeeded",
  PAYMENT_FAILED: "payment_failed",
  ORDER_STATUS_CHANGED: "order_status_changed",
  SHIPMENT_BOOKED: "shipment_booked",
  REFUND_INITIATED: "refund_initiated",
  REFUND_COMPLETED: "refund_completed",
  REFUND_FAILED: "refund_failed",
  // Customer: support and catalog
  SUPPORT_REPLY: "support_reply",
  SUPPORT_STATUS_CHANGED: "support_status_changed",
  BACK_IN_STOCK: "back_in_stock",
  // Admin: commerce
  NEW_ORDER: "new_order",
  PAYMENT_ISSUE: "payment_issue",
  CANCELLATION_REQUESTED: "cancellation_requested",
  RETURN_REQUESTED: "return_requested",
  ADMIN_REFUND_FAILED: "admin_refund_failed",
  LOW_STOCK: "low_stock",
  OUT_OF_STOCK: "out_of_stock",
  // Admin: support
  SUPPORT_NEW_CONVERSATION: "support_new_conversation",
  SUPPORT_CUSTOMER_MESSAGE: "support_customer_message",
  SUPPORT_UNANSWERED: "support_unanswered",
  // Admin: shipping and operations
  SHIPMENT_BOOKING_FAILED: "shipment_booking_failed",
  SHIPMENT_RECONCILIATION: "shipment_reconciliation",
  MANIFEST_FAILED: "manifest_failed",
  JOB_FAILED: "job_failed",
  INTEGRATION_ERROR: "integration_error",
};

export const NOTIFICATION_TYPE_VALUES = Object.values(NOTIFICATION_TYPE);

export const NOTIFICATION_SEVERITY = {
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
  CRITICAL: "critical",
};

/**
 * Admin notifications are scoped to an audience so that permission-restricted
 * admins only receive (and can only read) what they are allowed to see.
 */
export const ADMIN_AUDIENCE = {
  COMMERCE: "commerce",
  FINANCE: "finance",
  SUPPORT: "support",
  OPERATIONS: "operations",
  CATALOG: "catalog",
};

export const ADMIN_AUDIENCE_VALUES = Object.values(ADMIN_AUDIENCE);

export const NOTIFICATION_ENTITY = {
  ORDER: "order",
  PAYMENT: "payment",
  PRODUCT: "product",
  SUPPORT_CONVERSATION: "support_conversation",
  SERVICE_REQUEST: "service_request",
  JOB: "job",
  WEBHOOK: "webhook",
};

/**
 * Optional (non-transactional) notification types and the customer preference
 * that controls them. Types not listed here are essential and always delivered in-app.
 */
export const OPTIONAL_NOTIFICATION_PREFERENCE = {
  [NOTIFICATION_TYPE.BACK_IN_STOCK]: "backInStock",
};

/** Customer notification types that may also be emailed, and the email preference gating them. */
export const EMAIL_NOTIFICATION_PREFERENCE = {
  [NOTIFICATION_TYPE.PAYMENT_SUCCEEDED]: "orderUpdates",
  [NOTIFICATION_TYPE.REFUND_INITIATED]: "orderUpdates",
  [NOTIFICATION_TYPE.REFUND_COMPLETED]: "orderUpdates",
  [NOTIFICATION_TYPE.SHIPMENT_BOOKED]: "shippingUpdates",
};

export const NOTIFICATION_LIMITS = {
  titleMax: 140,
  messageMax: 400,
  pageDefault: 20,
  pageMax: 50,
  /** Unread counts above this are displayed as "99+"; counting stops here. */
  unreadCountCap: 100,
  retentionDays: Number(process.env.NOTIFICATION_RETENTION_DAYS ?? 180),
  /** Customer-written support messages older than this without a team reply raise an alert. */
  supportUnansweredHours: Number(process.env.SUPPORT_UNANSWERED_ALERT_HOURS ?? 12),
};

export const LOW_STOCK_THRESHOLD = Number(process.env.LOW_STOCK_THRESHOLD ?? 5);
