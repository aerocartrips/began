export const MAX_SAVED_ADDRESSES = 10;

export const ADDRESS_LABELS = ["home", "office", "other"];

export const ADDRESS_LABEL_TEXT = {
  home: "Home",
  office: "Office",
  other: "Other",
};

export const DEFAULT_ADDRESS_TYPES = ["shipping", "billing", "both"];

export const DEFAULT_COUNTRY = "India";

/** States and union territories accepted for Indian addresses. */
export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

export const NOTIFICATION_PREFERENCE_KEYS = ["orderUpdates", "shippingUpdates", "promotional"];

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  orderUpdates: true,
  shippingUpdates: true,
  promotional: false,
};

export const SECURITY_EVENT = {
  PASSWORD_CHANGED: "password_changed",
  SESSIONS_REVOKED: "sessions_revoked",
  EMAIL_CHANGE_REQUESTED: "email_change_requested",
  EMAIL_VERIFIED: "email_verified",
  PROFILE_UPDATED: "profile_updated",
  DELETION_REQUESTED: "deletion_requested",
  DELETION_CANCELLED: "deletion_cancelled",
};

export const SECURITY_EVENT_LABELS = {
  password_changed: "Password changed",
  sessions_revoked: "Signed out of all devices",
  email_change_requested: "Email change requested",
  email_verified: "Email address verified",
  profile_updated: "Profile details updated",
  deletion_requested: "Account deletion requested",
  deletion_cancelled: "Account deletion request cancelled",
};

/** Most recent security events retained on the account. */
export const SECURITY_EVENT_HISTORY = 20;

export const DELETION_REQUEST_STATUS = {
  NONE: "none",
  PENDING: "pending",
  COMPLETED: "completed",
};

export const DELETION_CONFIRMATION_PHRASE = "DELETE";

export const EMAIL_VERIFICATION_TTL_MS = 60 * 60 * 1000;

export const ACCOUNT_RATE_LIMITS = {
  passwordChange: { limit: 5, windowMs: 15 * 60 * 1000 },
  emailChange: { limit: 3, windowMs: 60 * 60 * 1000 },
  emailVerify: { limit: 10, windowMs: 15 * 60 * 1000 },
  profileUpdate: { limit: 20, windowMs: 15 * 60 * 1000 },
  addressWrite: { limit: 40, windowMs: 15 * 60 * 1000 },
  avatarUpload: { limit: 10, windowMs: 60 * 60 * 1000 },
  dataExport: { limit: 3, windowMs: 60 * 60 * 1000 },
  deletionRequest: { limit: 5, windowMs: 60 * 60 * 1000 },
};
