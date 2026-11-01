export type AccountProfile = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  isEmailVerified: boolean;
  pendingEmail: string;
  pendingEmailExpiresAt: string | null;
  phone: string;
  companyName: string;
  gstNumber: string;
  avatarUrl: string;
  createdAt: string | null;
};

export type AccountCapabilities = {
  emailVerification: boolean;
  avatarUpload: boolean;
};

export type AddressLabel = "home" | "office" | "other";

export type AddressInput = {
  label: AddressLabel;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  gstin: string;
};

export type SavedAddress = AddressInput & {
  id: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
  updatedAt: string | null;
};

export type AddressBook = {
  items: SavedAddress[];
  defaultShippingId: string | null;
  defaultBillingId: string | null;
  limit: number;
};

export type NotificationPreferences = {
  orderUpdates: boolean;
  shippingUpdates: boolean;
  promotional: boolean;
  backInStock: boolean;
  promotionalConsentAt: string | null;
};

export type SecurityEvent = {
  type: string;
  at: string | null;
  ip: string;
};

export type SecurityOverview = {
  isEmailVerified: boolean;
  passwordChangedAt: string | null;
  lastLoginAt: string | null;
  memberSince: string | null;
  activity: SecurityEvent[];
};

export type DeletionRequest = {
  status: "none" | "pending" | "completed";
  requestedAt: string | null;
  reason: string;
};

export type FieldErrors = Record<string, string>;
