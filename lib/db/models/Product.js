import mongoose from "mongoose";
import { tenantScopePlugin } from "@/lib/db/plugins/tenant-scope";
import { invalidateCatalogCache } from "@/lib/catalog/catalog-cache";
// Products reference categories and types; registering the schemas here keeps populate() working everywhere.
import "@/lib/db/models/Category";
import { sizeChartSchema } from "@/lib/db/models/ProductType";
import { PRODUCT_STATUS } from "@/lib/constants/product-status";
import { MAX_PRODUCT_VARIANTS } from "@/lib/constants/catalog";
import { searchTextOf, variantTitleOf } from "@/lib/catalog/variants";

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

/** One value of a product detail (attribute). Multi-value attributes have one entry per value. */
const attributeValueSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true, maxlength: 32 },
    value: { type: String, required: true, trim: true, maxlength: 200 },
  },
  { _id: false },
);

/** Photos of one colour, shared by every variant (size) in that colour. */
const colorMediaSchema = new mongoose.Schema(
  {
    color: { type: String, required: true, trim: true, maxlength: 80 },
    images: { type: [imageSchema], default: [] },
  },
  { _id: false },
);

/**
 * One purchasable combination of the type's options (Red / M), with its own
 * SKU and stock. Its `_id` is what carts, orders, quotes and the stock ledger
 * point at, so it is kept for as long as the combination exists.
 */
const variantSchema = new mongoose.Schema(
  {
    /** Option key → value, in the type's option order, e.g. { color: "Red", size: "M" }. */
    options: { type: Map, of: String, default: {} },
    /** "Red / M": the option values joined, for carts, orders and invoices. Derived on save. */
    title: { type: String, trim: true, maxlength: 200, default: "" },
    /** The colour option's value ("" without one), for swatches and photos. */
    colorName: { type: String, trim: true, maxlength: 80, default: "" },
    colorHex: {
      type: String,
      trim: true,
      default: "#999999",
      validate: { validator: (value) => HEX_COLOR.test(value), message: "Colour must be #RRGGBB." },
    },
    sku: { type: String, required: true, uppercase: true, trim: true, maxlength: 64 },
    /** GTIN / EAN / UPC printed on the item, given to search engines. */
    barcode: { type: String, trim: true, maxlength: 32, default: "" },
    stockQuantity: { type: Number, required: true, min: 0, default: 0 },
    /** Pre-catalogue-upgrade colour photos; new photos live in Product.colorMedia. */
    images: { type: [imageSchema], default: undefined },
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
    /** What it is (Saree, T-shirt…): decides its details, options and size chart. */
    productType: { type: mongoose.Schema.Types.ObjectId, ref: "ProductType", default: null },
    /**
     * True while the store is not selling the product's type: hidden from the
     * storefront like an inactive product, without touching its own status.
     * Kept in step by lib/services/product-type.service.js.
     */
    typeHidden: { type: Boolean, default: false },
    description: { type: String, trim: true, maxlength: 10000, default: "" },
    shortDescription: { type: String, trim: true, maxlength: 400, default: "" },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    images: { type: [imageSchema], default: [] },
    /** Product details as canonical attribute values (lib/services/attribute.service.js). */
    attributes: { type: [attributeValueSchema], default: [] },
    /** Colour families for filtering and personalisation; derived from the variants. */
    colors: { type: [String], default: [] },
    /** Sizes on offer, e.g. "S–XXL", for product cards. Maintained by the product service. */
    sizeRange: { type: String, trim: true, maxlength: 40, default: "" },
    careInstructions: { type: String, trim: true, maxlength: 2000, default: "" },
    variants: {
      type: [variantSchema],
      default: [],
      validate: { validator: (list) => list.length <= MAX_PRODUCT_VARIANTS, message: `Up to ${MAX_PRODUCT_VARIANTS} variants.` },
    },
    colorMedia: { type: [colorMediaSchema], default: [] },
    /** This product's own size chart; null uses its type's. */
    sizeChart: { type: sizeChartSchema, default: null },
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
    /** Detail and option values for full-text search. Maintained automatically. */
    searchText: { type: String, select: false, default: "" },
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
  for (const variant of this.variants ?? []) variant.title = variantTitleOf(variant.options, variant.colorName);
  if (this.variants?.length) {
    this.stockQuantity = this.variants.reduce((total, variant) => total + (variant.stockQuantity ?? 0), 0);
    this.colors = [...new Set(this.variants.map((variant) => variant.colorName).filter(Boolean))];
  }
  this.searchText = searchTextOf(this);
});

// Storefront listing: every query is scoped to tenant + active status (ESR: equality, sort, range).
// Sort indexes end with _id, matching the _id tiebreak in lib/catalog/query.js, so MongoDB walks
// the index in order and reads only the requested page instead of sorting the whole catalogue.
productSchema.index({ tenantId: 1, status: 1, createdAt: -1, _id: -1 });
productSchema.index({ tenantId: 1, status: 1, category: 1, createdAt: -1, _id: -1 });
productSchema.index({ tenantId: 1, status: 1, productType: 1, createdAt: -1, _id: -1 });
productSchema.index({ tenantId: 1, status: 1, wholesalePrice: 1, _id: 1 });
productSchema.index({ tenantId: 1, status: 1, price: 1, _id: 1 });
productSchema.index({ tenantId: 1, status: 1, popularityScore: -1, _id: -1 });
productSchema.index({ tenantId: 1, status: 1, category: 1, popularityScore: -1, _id: -1 });
productSchema.index({ tenantId: 1, status: 1, productType: 1, popularityScore: -1, _id: -1 });
productSchema.index({ tenantId: 1, status: 1, salesCount: -1, popularityScore: -1, _id: -1 });
productSchema.index({ tenantId: 1, status: 1, trendingScore: -1, _id: -1 });
productSchema.index({ tenantId: 1, status: 1, featured: -1, createdAt: -1, _id: -1 });
// Attribute pattern: one multikey index serves every detail filter ({ key, value } pairs).
productSchema.index({ tenantId: 1, status: 1, "attributes.key": 1, "attributes.value": 1 });
productSchema.index({ tenantId: 1, status: 1, colors: 1 });
productSchema.index({ tenantId: 1, status: 1, nameLower: 1 });
productSchema.index(
  { tenantId: 1, name: "text", sku: "text", shortDescription: "text", searchText: "text" },
  { weights: { name: 10, sku: 8, searchText: 4, shortDescription: 1 }, name: "product_text" },
);
// Admin and integrity.
productSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
productSchema.index({ tenantId: 1, previousSlugs: 1 });
productSchema.index({ tenantId: 1, sku: 1 }, { unique: true });
productSchema.index({ tenantId: 1, "variants.sku": 1 }, { partialFilterExpression: { "variants.sku": { $type: "string" } } });
productSchema.index({ tenantId: 1, productType: 1, createdAt: -1 });
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
