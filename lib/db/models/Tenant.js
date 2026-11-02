import mongoose from "mongoose";
import { SALES_MODE } from "@/lib/constants/sales-mode";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const hexColor = (fallback) => ({
  type: String,
  trim: true,
  default: fallback,
  validate: { validator: (value) => HEX_COLOR.test(value), message: "Colours must be #RRGGBB." },
});

/** Encrypted with lib/tenant/secrets.js; never sent to the browser. */
const encryptedSecret = { type: String, default: "", select: false };

const tenantSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 60, match: /^[a-z0-9-]+$/ },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    /** Hostnames (no port) that serve this store, e.g. "shop.example.com", "localhost". */
    domains: {
      type: [{ type: String, trim: true, lowercase: true, maxlength: 253 }],
      validate: { validator: (list) => list.length > 0, message: "At least one domain is required." },
    },
    salesMode: { type: String, enum: Object.values(SALES_MODE), default: SALES_MODE.WHOLESALE },
    branding: {
      siteTitle: { type: String, trim: true, maxlength: 160, default: "" },
      tagline: { type: String, trim: true, maxlength: 240, default: "" },
      description: { type: String, trim: true, maxlength: 320, default: "" },
      logoUrl: { type: String, trim: true, maxlength: 2048, default: "" },
      heroImageUrl: { type: String, trim: true, maxlength: 2048, default: "" },
      faviconUrl: { type: String, trim: true, maxlength: 2048, default: "" },
      theme: {
        brand: hexColor("#6863ed"),
        brandSecondary: hexColor("#a05ce9"),
        accent: hexColor("#21bfd0"),
        text: hexColor("#1d2433"),
        textMuted: hexColor("#7b8493"),
        background: hexColor("#f8f9fc"),
        surface: hexColor("#ffffff"),
        border: hexColor("#e7e9ef"),
      },
    },
    contact: {
      email: { type: String, trim: true, lowercase: true, maxlength: 254, default: "" },
      phone: { type: String, trim: true, maxlength: 40, default: "" },
      address: { type: String, trim: true, maxlength: 500, default: "" },
      hours: { type: String, trim: true, maxlength: 160, default: "" },
      social: {
        instagram: { type: String, trim: true, maxlength: 2048, default: "" },
        linkedin: { type: String, trim: true, maxlength: 2048, default: "" },
        x: { type: String, trim: true, maxlength: 2048, default: "" },
      },
    },
    business: {
      legalName: { type: String, trim: true, maxlength: 200, default: "" },
      gstin: { type: String, trim: true, uppercase: true, maxlength: 15, default: "" },
      registeredAddress: { type: String, trim: true, maxlength: 500, default: "" },
      invoicePrefix: { type: String, trim: true, uppercase: true, maxlength: 20, default: "INV" },
    },
    notifications: {
      /** Store inbox for new-order and contact alerts. */
      email: { type: String, trim: true, lowercase: true, maxlength: 254, default: "" },
    },
    integrations: {
      razorpay: {
        keyId: { type: String, trim: true, maxlength: 120, default: "" },
        keySecret: encryptedSecret,
        webhookSecret: encryptedSecret,
      },
      delhivery: {
        apiToken: encryptedSecret,
        b2bUsername: { type: String, trim: true, maxlength: 160, default: "" },
        b2bPassword: encryptedSecret,
      },
    },
  },
  { timestamps: true },
);

tenantSchema.index({ slug: 1 }, { unique: true });
// Multikey unique index: a hostname can belong to only one store.
tenantSchema.index({ domains: 1 }, { unique: true });
tenantSchema.index({ status: 1 });

/** Platform-level collection: intentionally not tenant-scoped. */
export const Tenant = mongoose.models.Tenant ?? mongoose.model("Tenant", tenantSchema);
