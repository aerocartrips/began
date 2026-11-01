import mongoose from "mongoose";
import { ROLES } from "@/lib/constants/roles";
import {
  ADDRESS_LABELS,
  DEFAULT_COUNTRY,
  DELETION_REQUEST_STATUS,
  SECURITY_EVENT,
} from "@/lib/constants/account";

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, enum: ADDRESS_LABELS, default: "home" },
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 25 },
    addressLine1: { type: String, required: true, trim: true, maxlength: 200 },
    addressLine2: { type: String, trim: true, maxlength: 200, default: "" },
    landmark: { type: String, trim: true, maxlength: 120, default: "" },
    city: { type: String, required: true, trim: true, maxlength: 80 },
    state: { type: String, required: true, trim: true, maxlength: 80 },
    pincode: { type: String, required: true, trim: true, maxlength: 12 },
    country: { type: String, required: true, trim: true, maxlength: 80, default: DEFAULT_COUNTRY },
    gstin: { type: String, trim: true, uppercase: true, maxlength: 15, default: "" },
  },
  { _id: true, timestamps: true },
);

const securityEventSchema = new mongoose.Schema(
  {
    type: { type: String, enum: Object.values(SECURITY_EVENT), required: true },
    at: { type: Date, default: Date.now },
    ip: { type: String, trim: true, maxlength: 64, default: "" },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    /** Display name used across orders, invoices, support and admin. Kept in sync with first/last name. */
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    firstName: { type: String, trim: true, maxlength: 60, default: "" },
    lastName: { type: String, trim: true, maxlength: 60, default: "" },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    password: { type: String, required: true, select: false, minlength: 60, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 25, default: "" },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.CUSTOMER, index: true },
    companyName: { type: String, trim: true, maxlength: 160, default: "" },
    gstNumber: { type: String, trim: true, maxlength: 20, default: "" },
    avatar: {
      publicId: { type: String, trim: true, maxlength: 260, default: "" },
      url: { type: String, trim: true, maxlength: 2048, default: "" },
    },
    isActive: { type: Boolean, default: true, index: true },
    isEmailVerified: { type: Boolean, default: false },
    emailVerification: {
      pendingEmail: { type: String, lowercase: true, trim: true, maxlength: 254, default: "" },
      tokenHash: { type: String, select: false, default: "" },
      expiresAt: { type: Date, default: null },
    },
    addresses: { type: [addressSchema], default: [] },
    defaultShippingAddressId: { type: mongoose.Schema.Types.ObjectId, default: null },
    defaultBillingAddressId: { type: mongoose.Schema.Types.ObjectId, default: null },
    notificationPreferences: {
      orderUpdates: { type: Boolean, default: true },
      shippingUpdates: { type: Boolean, default: true },
      promotional: { type: Boolean, default: false },
      promotionalConsentAt: { type: Date, default: null },
    },
    /** Incremented to revoke every issued access/refresh token. */
    sessionVersion: { type: Number, default: 0, min: 0 },
    passwordChangedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    securityEvents: { type: [securityEventSchema], default: [], select: false },
    deletionRequest: {
      status: {
        type: String,
        enum: Object.values(DELETION_REQUEST_STATUS),
        default: DELETION_REQUEST_STATUS.NONE,
      },
      requestedAt: { type: Date, default: null },
      reason: { type: String, trim: true, maxlength: 500, default: "" },
      completedAt: { type: Date, default: null },
    },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ "emailVerification.tokenHash": 1 }, { partialFilterExpression: { "emailVerification.tokenHash": { $gt: "" } } });
userSchema.index({ "deletionRequest.status": 1 }, { partialFilterExpression: { "deletionRequest.status": DELETION_REQUEST_STATUS.PENDING } });

export const User =
  mongoose.models.User ?? mongoose.model("User", userSchema);

export function toPublicUser(document) {
  if (!document) return null;
  const user = typeof document.toObject === "function" ? document.toObject() : { ...document };
  delete user.password;
  delete user.sessionVersion;
  delete user.securityEvents;
  if (user.emailVerification) {
    const { tokenHash: _tokenHash, ...emailVerification } = user.emailVerification;
    user.emailVerification = emailVerification;
  }
  return user;
}
