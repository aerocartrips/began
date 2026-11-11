import mongoose from "mongoose";
import { tenantScopePlugin } from "@/lib/db/plugins/tenant-scope";

/**
 * Operational settings for one store. Store identity (name, branding, contact,
 * business/GST details, sales mode) lives on the Tenant document.
 */
const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, default: "store" },
    orders: {
      paymentReservationMinutes: { type: Number, min: 5, max: 1440, default: 30 },
      cancellationWindowHours: { type: Number, min: 0, max: 720, default: 48 },
      returnWindowDays: { type: Number, min: 0, max: 90, default: 7 },
    },
    commerce: {
      /** GST added to products without their own rate, and to shipping. */
      defaultGstRatePercent: { type: Number, min: 0, max: 28, default: 0 },
      shippingFlatAmount: { type: Number, min: 0, max: 100000, default: 0 },
      /** Order subtotal (₹) at or above which shipping is free; 0 disables. */
      shippingFreeThreshold: { type: Number, min: 0, max: 10000000, default: 0 },
      lowStockThreshold: { type: Number, min: 0, max: 100000, default: 5 },
      /**
       * Working days from payment to dispatch, quoted by the default shipping
       * policy and given to search engines with every product (Google requires
       * a delivery time in product shipping details). Max 0 = not stated.
       */
      dispatchMinDays: { type: Number, min: 0, max: 60, default: 2 },
      dispatchMaxDays: { type: Number, min: 0, max: 60, default: 4 },
      /** Courier days from dispatch to delivery, across India. Max 0 = not stated. */
      transitMinDays: { type: Number, min: 0, max: 60, default: 0 },
      transitMaxDays: { type: Number, min: 0, max: 60, default: 0 },
    },
    shipping: {
      pickupLocationName: { type: String, trim: true, maxlength: 160, default: "" },
      pickupPincode: { type: String, trim: true, maxlength: 12, default: "" },
      defaultWeightKg: { type: Number, min: 0.1, max: 500, default: 1 },
      defaultBoxCount: { type: Number, min: 1, max: 100, default: 1 },
      freightMode: { type: String, trim: true, maxlength: 40, default: "prepaid" },
    },
    version: { type: Number, default: 1, min: 1 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

settingsSchema.index({ tenantId: 1, key: 1 }, { unique: true });
settingsSchema.plugin(tenantScopePlugin);

export const StoreSettings =
  mongoose.models.StoreSettings ?? mongoose.model("StoreSettings", settingsSchema);

/** The current store's settings document, created with defaults on first use. */
export async function getStoreSettingsDocument() {
  return StoreSettings.findOneAndUpdate(
    { key: "store" },
    { $setOnInsert: { key: "store" } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
}
