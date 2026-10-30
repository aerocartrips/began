import mongoose from "mongoose";
import { ROLES } from "@/lib/constants/roles";

const addressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 25 },
    addressLine1: { type: String, required: true, trim: true, maxlength: 200 },
    addressLine2: { type: String, trim: true, maxlength: 200, default: "" },
    city: { type: String, required: true, trim: true, maxlength: 80 },
    state: { type: String, required: true, trim: true, maxlength: 80 },
    pincode: { type: String, required: true, trim: true, maxlength: 12 },
    country: { type: String, required: true, trim: true, maxlength: 80, default: "India" },
    addressType: {
      type: String,
      enum: ["shipping", "billing", "both"],
      default: "both",
    },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true, timestamps: false },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      index: true,
    },
    password: { type: String, required: true, select: false, minlength: 60, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 25, default: "" },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.CUSTOMER, index: true },
    companyName: { type: String, trim: true, maxlength: 160, default: "" },
    gstNumber: { type: String, trim: true, maxlength: 20, default: "" },
    isActive: { type: Boolean, default: true, index: true },
    isEmailVerified: { type: Boolean, default: false },
    addresses: { type: [addressSchema], default: [] },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1, isActive: 1 });

export const User =
  mongoose.models.User ?? mongoose.model("User", userSchema);

export function toPublicUser(document) {
  if (!document) return null;
  const user = typeof document.toObject === "function" ? document.toObject() : document;
  delete user.password;
  return user;
}
