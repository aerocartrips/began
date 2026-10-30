import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "store" },
    general: {
      storeName: { type: String, trim: true, maxlength: 160, default: "Norosilk" },
      supportEmail: { type: String, trim: true, maxlength: 254, default: "" },
      supportPhone: { type: String, trim: true, maxlength: 40, default: "" },
      businessAddress: { type: String, trim: true, maxlength: 500, default: "" },
      defaultCurrency: { type: String, trim: true, uppercase: true, maxlength: 3, default: "INR" },
      timeZone: { type: String, trim: true, maxlength: 64, default: "Asia/Kolkata" },
    },
    business: {
      legalName: { type: String, trim: true, maxlength: 200, default: "" },
      gstin: { type: String, trim: true, maxlength: 20, default: "" },
      registeredAddress: { type: String, trim: true, maxlength: 500, default: "" },
      invoicePrefix: { type: String, trim: true, maxlength: 20, default: "INV" },
    },
    orders: {
      paymentReservationMinutes: { type: Number, min: 5, max: 1440, default: 30 },
      cancellationWindowHours: { type: Number, min: 0, max: 720, default: 48 },
      returnWindowDays: { type: Number, min: 0, max: 90, default: 7 },
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

export const StoreSettings =
  mongoose.models.StoreSettings ?? mongoose.model("StoreSettings", settingsSchema);

export async function getStoreSettingsDocument() {
  let doc = await StoreSettings.findOne({ key: "store" });
  if (!doc) {
    doc = await StoreSettings.create({ key: "store" });
  }
  return doc;
}
