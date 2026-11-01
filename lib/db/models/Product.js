import mongoose from "mongoose";
import { invalidateCatalogCache } from "@/lib/catalog/catalog-cache";
// Products reference categories; registering the schema here keeps populate("category") working everywhere.
import "@/lib/db/models/Category";
import { PRODUCT_STATUS } from "@/lib/constants/product-status";

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

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 180 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    description: { type: String, trim: true, maxlength: 10000, default: "" },
    shortDescription: { type: String, trim: true, maxlength: 400, default: "" },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    images: { type: [imageSchema], default: [] },
    fabric: { type: String, trim: true, maxlength: 80, default: "", index: true },
    weavingType: { type: String, trim: true, maxlength: 80, default: "", index: true },
    sareeLength: { type: String, trim: true, maxlength: 40, default: "" },
    blousePiece: { type: String, trim: true, maxlength: 40, default: "" },
    colors: { type: [String], default: [] },
    design: { type: String, trim: true, maxlength: 120, default: "" },
    occasion: { type: String, trim: true, maxlength: 120, default: "" },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0, default: 0 },
    wholesalePrice: { type: Number, required: true, min: 0 },
    bulkPricingTiers: { type: [bulkTierSchema], default: [] },
    minimumOrderQuantity: { type: Number, required: true, min: 1, default: 1 },
    stockQuantity: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: Object.values(PRODUCT_STATUS),
      default: PRODUCT_STATUS.DRAFT,
      index: true,
    },
    featured: { type: Boolean, default: false, index: true },
    popularityScore: { type: Number, default: 0, min: 0 },
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

productSchema.index({ name: "text", sku: "text", shortDescription: "text" });
productSchema.index({ wholesalePrice: 1, status: 1 });
productSchema.index({ createdAt: -1 });

// Any product write (admin edits, image changes, stock movements, rating updates)
// invalidates the cached storefront catalog.
productSchema.post(
  ["save", "updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "findOneAndDelete"],
  () => invalidateCatalogCache(),
);

export const Product =
  mongoose.models.Product ?? mongoose.model("Product", productSchema);
