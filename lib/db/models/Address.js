import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
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
  { timestamps: true },
);

addressSchema.index({ user: 1, isDefault: 1 });

export const Address =
  mongoose.models.Address ?? mongoose.model("Address", addressSchema);
