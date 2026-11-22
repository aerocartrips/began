import mongoose from "mongoose";
import { tenantScopePlugin } from "@/lib/db/plugins/tenant-scope";
import { invalidateCatalogCache } from "@/lib/catalog/catalog-cache";
import {
  ATTRIBUTE_INPUT_VALUES,
  ATTRIBUTE_KEY_PATTERN,
  MAX_ATTRIBUTE_VALUES,
  SCHEMA_PROPERTY_VALUES,
} from "@/lib/constants/catalog";

const valueSchema = new mongoose.Schema(
  {
    /** Canonical spelling: products store exactly this, so filters never split "Pure Silk" from "pure silk". */
    label: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 90 },
    /** Swatch colour, for colour attributes. */
    hex: { type: String, trim: true, default: "", match: /^(#[0-9a-fA-F]{6})?$/ },
    sortOrder: { type: Number, default: 0, min: 0, max: 100000 },
    /** Inactive values stay on the products that have them but can't be chosen again. */
    isActive: { type: Boolean, default: true },
  },
  { _id: true },
);

/**
 * A reusable product field in the store's attribute library: Fabric, Colour,
 * Size, Fit… Product types pick the attributes their products use (see
 * ProductType); products store each value under the attribute's `key`.
 * Sharing an attribute between types keeps one storefront filter for it
 * ("Colour: Red" across sarees and T-shirts).
 */
const productAttributeSchema = new mongoose.Schema(
  {
    /** URL parameter and storage key (`/products?fabric=Silk`); fixed once created. */
    key: { type: String, required: true, trim: true, maxlength: 32, match: ATTRIBUTE_KEY_PATTERN, immutable: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    /** Fixed once created: changing it would leave existing values in the wrong shape. */
    input: { type: String, enum: ATTRIBUTE_INPUT_VALUES, required: true, immutable: true },
    /** Shown after numbers ("6.3 m"). */
    unit: { type: String, trim: true, maxlength: 12, default: "" },
    values: {
      type: [valueSchema],
      default: [],
      validate: { validator: (list) => list.length <= MAX_ATTRIBUTE_VALUES, message: `Up to ${MAX_ATTRIBUTE_VALUES} values.` },
    },
    /** Offered as a storefront filter (list and yes/no inputs only). */
    filterable: { type: Boolean, default: false },
    /** Listed in the product page's specifications. */
    visible: { type: Boolean, default: true },
    /** What it means to search engines (product structured data). */
    schemaProperty: { type: String, enum: SCHEMA_PROPERTY_VALUES, default: "" },
    helpText: { type: String, trim: true, maxlength: 200, default: "" },
    sortOrder: { type: Number, default: 0, min: 0, max: 100000 },
  },
  { timestamps: true },
);

productAttributeSchema.index({ tenantId: 1, key: 1 }, { unique: true });
productAttributeSchema.index({ tenantId: 1, sortOrder: 1, name: 1 });

// Names, values and swatches appear on cached catalogue pages and in filters.
productAttributeSchema.post(
  ["save", "updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "findOneAndDelete"],
  () => invalidateCatalogCache(),
);
productAttributeSchema.plugin(tenantScopePlugin);

export const ProductAttribute =
  mongoose.models.ProductAttribute ?? mongoose.model("ProductAttribute", productAttributeSchema);
