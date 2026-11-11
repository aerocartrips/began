import mongoose from "mongoose";
import { tenantScopePlugin } from "@/lib/db/plugins/tenant-scope";
import { invalidateCatalogCache } from "@/lib/catalog/catalog-cache";
// Products reference categories; registering the schema here keeps populate("category") working everywhere.
import "@/lib/db/models/Category";
import { PRODUCT_STATUS } from "@/lib/constants/product-status";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const imageSchema = new mongoose.Schema(
  {
    publicId: { type: String, trim: true, default: "", maxlength: 260 },
    url: { type: String, required: true, trim: true },
    secureUrl: { type: String, trim: true, default: "" },
    alt: { type: String, trim: true, default: "", maxlength: 160 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    format: { type: String, trim: true, maxlength: 12, default: "" },
    bytes: { type: Number, min: 0 },
    isPrimary: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0, min: 0, max: 1000 },
  },
  { _id: true, timestamps: false },
);

const bulkTierSchema = new mongoose.Schema(
  {
    minQuantity: { type: Number, required: true, min: 1 },
    pricePerUnit: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

/** A colour of the same saree, shown as a swatch with its own SKU, stock and photos. */
const variantSchema = new mongoose.Schema(
  {
    colorName: { type: String, required: true, trim: true, maxlength: 60 },
    colorHex: {
      type: String,
      trim: true,
      default: "#999999",
      validate: { validator: (value) => HEX_COLOR.test(value), message: "Colour must be #RRGGBB." },
    },
    sku: { type: String, required: true, uppercase: true, trim: true, maxlength: 64 },
    stockQuantity: { type: Number, required: true, min: 0, default: 0 },
    images: { type: [imageSchema], default: [] },
    sortOrder: { type: Number, default: 0, min: 0, max: 1000 },
  },
  { _id: true, timestamps: false },
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 180 },
    /** Lower-cased name for indexed prefix search (autocomplete). Maintained automatically. */
    nameLower: { type: String, select: false },
    slug: { type: String, required: true, lowercase: true, trim: true },
    /** Slugs this product had before; their URLs redirect permanently to the current one. */
    previousSlugs: { type: [{ type: String, lowercase: true, trim: true }], default: [] },
    sku: { type: String, required: true, uppercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 10000, default: "" },
    shortDescription: { type: String, trim: true, maxlength: 400, default: "" },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    images: { type: [imageSchema], default: [] },
    // Attribute values are canonical labels from the store's Attribute lists.
    fabric: { type: String, trim: true, maxlength: 80, default: "" },
    weavingType: { type: String, trim: true, maxlength: 80, default: "" },
    occasion: { type: String, trim: true, maxlength: 120, default: "" },
    design: { type: String, trim: true, maxlength: 120, default: "" },
    /** Colour families for filtering; derived from variants when the product has any. */
    colors: { type: [String], default: [] },
    sareeLength: { type: String, trim: true, maxlength: 40, default: "" },
    blousePiece: { type: String, trim: true, maxlength: 40, default: "" },
    careInstructions: { type: String, trim: true, maxlength: 2000, default: "" },
    variants: { type: [variantSchema], default: [] },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0, default: 0 },
    wholesalePrice: { type: Number, required: true, min: 0 },
    bulkPricingTiers: { type: [bulkTierSchema], default: [] },
    minimumOrderQuantity: { type: Number, required: true, min: 1, default: 1 },
    /** Total units; the sum of variant stock when the product has variants. */
    stockQuantity: { type: Number, required: true, min: 0, default: 0 },
    hsnCode: { type: String, trim: true, maxlength: 8, default: "", match: /^(\d{4}|\d{6}|\d{8})?$/ },
    /** GST rate for this product; falls back to the store default when unset. */
    gstRatePercent: { type: Number, min: 0, max: 28, default: null },
    status: {
      type: String,
      enum: Object.values(PRODUCT_STATUS),
      default: PRODUCT_STATUS.DRAFT,
    },
    featured: { type: Boolean, default: false },
    // Demand metrics, recomputed by lib/jobs/product-metrics.job.js from orders and shopper activity.
    popularityScore: { type: Number, default: 0, min: 0 },
    trendingScore: { type: Number, default: 0, min: 0 },
    /** Paid orders containing this product in the best-seller window. */
    salesCount: { type: Number, default: 0, min: 0 },
    metricsUpdatedAt: { type: Date, default: null },
    seoTitle: { type: String, trim: true, maxlength: 160, default: "" },
    seoDescription: { type: String, trim: true, maxlength: 320, default: "" },
    ratingSummary: {
      averageRating: { type: Number, default: 0, min: 0, max: 5 },
      totalReviews: { type: Number, default: 0, min: 0 },
      distribution: {
        1: { type: Number, default: 0, min: 0 },
        2: { type: Number, default: 0, min: 0 },
        3: { type: Number, default: 0, min: 0 },
        4: { type: Number, default: 0, min: 0 },
        5: { type: Number, default: 0, min: 0 },
      },
    },
  },
  { timestamps: true },
);

productSchema.pre("validate", function deriveFields() {
  this.nameLower = this.name?.toLowerCase();
  if (this.variants?.length) {
    this.stockQuantity = this.variants.reduce((total, variant) => total + (variant.stockQuantity ?? 0), 0);
    this.colors = [...new Set(this.variants.map((variant) => variant.colorName))];
  }
});

// Storefront listing: every query is scoped to tenant + active status (ESR: equality, sort, range).
// Sort indexes end with _id, matching the _id tiebreak in lib/catalog/query.js, so MongoDB walks
// the index in order and reads only the requested page instead of sorting the whole catalogue.
productSchema.index({ tenantId: 1, status: 1, createdAt: -1, _id: -1 });
productSchema.index({ tenantId: 1, status: 1, category: 1, createdAt: -1, _id: -1 });
productSchema.index({ tenantId: 1, status: 1, wholesalePrice: 1, _id: 1 });
productSchema.index({ tenantId: 1, status: 1, price: 1, _id: 1 });
productSchema.index({ tenantId: 1, status: 1, popularityScore: -1, _id: -1 });
productSchema.index({ tenantId: 1, status: 1, category: 1, popularityScore: -1, _id: -1 });
productSchema.index({ tenantId: 1, status: 1, salesCount: -1, popularityScore: -1, _id: -1 });
productSchema.index({ tenantId: 1, status: 1, trendingScore: -1, _id: -1 });
productSchema.index({ tenantId: 1, status: 1, featured: -1, createdAt: -1, _id: -1 });
productSchema.index({ tenantId: 1, status: 1, fabric: 1 });
productSchema.index({ tenantId: 1, status: 1, colors: 1 });
productSchema.index({ tenantId: 1, status: 1, nameLower: 1 });
productSchema.index(
  { tenantId: 1, name: "text", sku: "text", shortDescription: "text", fabric: "text", weavingType: "text" },
  { weights: { name: 10, sku: 8, fabric: 4, weavingType: 4, shortDescription: 1 }, name: "product_text" },
);
// Admin and integrity.
productSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
productSchema.index({ tenantId: 1, previousSlugs: 1 });
productSchema.index({ tenantId: 1, sku: 1 }, { unique: true });
productSchema.index({ tenantId: 1, "variants.sku": 1 }, { partialFilterExpression: { "variants.sku": { $type: "string" } } });
productSchema.index({ tenantId: 1, createdAt: -1 });

// Any product write (admin edits, image changes, stock movements, rating updates)
// invalidates the current store's cached catalog.
productSchema.post(
  ["save", "updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "findOneAndDelete"],
  () => invalidateCatalogCache(),
);

productSchema.plugin(tenantScopePlugin);

export const Product =
  mongoose.models.Product ?? mongoose.model("Product", productSchema);
