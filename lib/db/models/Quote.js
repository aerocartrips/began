import mongoose from "mongoose";
import { tenantScopePlugin } from "@/lib/db/plugins/tenant-scope";
import { QUOTE_STATUS_VALUES, QUOTE_STATUS } from "@/lib/constants/quote-status";

const quoteItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    // Snapshot so the quote reads correctly even if the product changes later.
    productName: { type: String, required: true, trim: true, maxlength: 180 },
    productSlug: { type: String, trim: true, maxlength: 160, default: "" },
    sku: { type: String, required: true, trim: true, maxlength: 64 },
    colorName: { type: String, trim: true, maxlength: 60, default: "" },
    quantity: { type: Number, required: true, min: 1, max: 1000000 },
    /** Buyer's target price per piece (optional). */
    targetUnitPrice: { type: Number, min: 0, default: null },
    /** List price per piece when the quote was requested. */
    listUnitPrice: { type: Number, min: 0, required: true },
    /** Store's offered price per piece. */
    quotedUnitPrice: { type: Number, min: 0, default: null },
    notes: { type: String, trim: true, maxlength: 1000, default: "" },
  },
  { _id: true },
);

const historySchema = new mongoose.Schema(
  {
    status: { type: String, enum: QUOTE_STATUS_VALUES, required: true },
    note: { type: String, trim: true, maxlength: 2000, default: "" },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    byRole: { type: String, enum: ["customer", "admin", "system"], default: "system" },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const quoteSchema = new mongoose.Schema(
  {
    quoteNumber: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    contact: {
      name: { type: String, required: true, trim: true, maxlength: 120 },
      email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
      phone: { type: String, trim: true, maxlength: 25, default: "" },
      companyName: { type: String, trim: true, maxlength: 160, default: "" },
      gstin: { type: String, trim: true, uppercase: true, maxlength: 15, default: "" },
    },
    items: { type: [quoteItemSchema], validate: [(items) => items.length > 0, "Add at least one product."] },
    message: { type: String, trim: true, maxlength: 4000, default: "" },
    requirements: {
      customBranding: { type: Boolean, default: false },
      customPackaging: { type: Boolean, default: false },
      deliveryPincode: { type: String, trim: true, maxlength: 12, default: "" },
      neededBy: { type: Date, default: null },
    },
    status: { type: String, enum: QUOTE_STATUS_VALUES, default: QUOTE_STATUS.SUBMITTED },
    response: {
      shippingCharges: { type: Number, min: 0, default: null },
      validUntil: { type: Date, default: null },
      notes: { type: String, trim: true, maxlength: 4000, default: "" },
      quotedAt: { type: Date, default: null },
      quotedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    },
    internalNotes: { type: String, trim: true, maxlength: 4000, default: "" },
    history: { type: [historySchema], default: [] },
  },
  { timestamps: true },
);

quoteSchema.index({ tenantId: 1, quoteNumber: 1 }, { unique: true });
quoteSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
quoteSchema.index({ tenantId: 1, customer: 1, createdAt: -1 });
quoteSchema.index({ tenantId: 1, "contact.email": 1, createdAt: -1 });
quoteSchema.plugin(tenantScopePlugin);

export const Quote = mongoose.models.Quote ?? mongoose.model("Quote", quoteSchema);
