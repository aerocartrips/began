export const SUPPORT_CATEGORY = {
  ORDER: "order",
  PAYMENT: "payment",
  SHIPPING: "shipping",
  PRODUCT: "product",
  RETURN: "return",
  OTHER: "other",
};

export const SUPPORT_CATEGORY_VALUES = Object.values(SUPPORT_CATEGORY);

export const SUPPORT_CATEGORY_LABELS = {
  order: "Order related",
  payment: "Payment issue",
  shipping: "Shipping and delivery",
  product: "Product inquiry",
  return: "Return / refund",
  other: "Other",
};

export const SUPPORT_SOURCE = {
  CONTACT: "contact",
  ACCOUNT: "account",
};

/** Status as shown to customers; internal workflow statuses collapse into these. */
export const CUSTOMER_SUPPORT_STATUS = {
  OPEN: "open",
  PENDING: "pending",
  RESOLVED: "resolved",
  CLOSED: "closed",
};

export const SUPPORT_LIMITS = {
  subjectMin: 3,
  subjectMax: 120,
  messageMax: 5000,
  previewLength: 160,
  messagesPageDefault: 30,
  messagesPageMax: 50,
  conversationsPageDefault: 20,
  conversationsPageMax: 50,
  /** A resolved conversation can be reopened by a customer reply within this window. */
  reopenWindowDays: 30,
};

export const SUPPORT_RATE_LIMITS = {
  createConversation: { limit: 5, windowMs: 60 * 60 * 1000 },
  sendMessage: { limit: 30, windowMs: 5 * 60 * 1000 },
};
