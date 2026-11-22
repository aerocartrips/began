import mongoose from "mongoose";
import { tenantScopePlugin } from "@/lib/db/plugins/tenant-scope";
import { invalidateCatalogCache } from "@/lib/catalog/catalog-cache";
import {
  ATTRIBUTE_KEY_PATTERN,
  MAX_SIZE_CHART_COLUMNS,
  MAX_SIZE_CHART_ROWS,
  MAX_TYPE_FIELDS,
  MAX_TYPE_OPTIONS,
  PRODUCT_TYPE_ICONS,
} from "@/lib/constants/catalog";

const attributeKey = { type: String, required: true, trim: true, match: ATTRIBUTE_KEY_PATTERN };
const maxItems = (max, what) => ({ validator: (list) => list.length <= max, message: `Up to ${max} ${what}.` });

/**
 * Measurements per size, shown from the product page's "Size guide". Values
 * are text so ranges ("38–40") and notes fit; numbers in them are converted
 * between inches and centimetres on the page.
 */
export const sizeChartSchema = new mongoose.Schema(
  {
    /** The option the chart describes (usually "size"). */
    optionKey: { type: String, trim: true, match: /^([a-z][a-z0-9_]{0,31})?$/, default: "" },
    unit: { type: String, enum: ["in", "cm"], default: "in" },
    columns: {
      type: [
        new mongoose.Schema(
          {
            label: { type: String, required: true, trim: true, maxlength: 40 },
            /** The measurement the fit finder asks shoppers for (e.g. Chest, Waist). */
            primary: { type: Boolean, default: false },
            /** Its numbers are lengths, converted between inches and centimetres (false for e.g. "EU size"). */
            measurement: { type: Boolean, default: true },
          },
          { _id: false },
        ),
      ],
      default: [],
      validate: maxItems(MAX_SIZE_CHART_COLUMNS, "columns"),
    },
    rows: {
      type: [
        new mongoose.Schema(
          {
            size: { type: String, required: true, trim: true, maxlength: 40 },
            values: { type: [{ type: String, trim: true, maxlength: 40 }], default: [] },
          },
          { _id: false },
        ),
      ],
      default: [],
      validate: maxItems(MAX_SIZE_CHART_ROWS, "sizes"),
    },
    note: { type: String, trim: true, maxlength: 500, default: "" },
    howToMeasure: {
      type: [
        new mongoose.Schema(
          {
            label: { type: String, required: true, trim: true, maxlength: 40 },
            text: { type: String, trim: true, maxlength: 300, default: "" },
          },
          { _id: false },
        ),
      ],
      default: [],
      validate: maxItems(MAX_SIZE_CHART_COLUMNS, "measuring tips"),
    },
  },
  { _id: false },
);

const fieldSchema = new mongoose.Schema(
  {
    key: attributeKey,
    /** Needed before a product of this type can be listed (drafts may leave it empty). */
    required: { type: Boolean, default: false },
  },
  { _id: false },
);

const optionSchema = new mongoose.Schema(
  {
    key: attributeKey,
    /**
     * The attribute values this type offers, in the order shoppers see them
     * (e.g. Jeans: 28–40 of a shared "Waist size" list). Empty = every value.
     */
    values: { type: [{ type: String, trim: true, maxlength: 80 }], default: [] },
  },
  { _id: false },
);

/**
 * Something the store sells: Saree, T-shirt, Jeans… It decides which details
 * the admin product form asks for, what shoppers choose (options), the size
 * chart and the defaults new products start with. `isActive` is the store's
 * "we sell this" switch: products of a type that is off are hidden from the
 * storefront (Product.typeHidden) without being changed.
 */
const productTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    /** Headings and navigation ("Shop T-shirts"). */
    pluralName: { type: String, required: true, trim: true, maxlength: 60 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 80, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
    /** Earlier slugs; their /shop/ URLs redirect permanently to the current one. */
    previousSlugs: { type: [{ type: String, lowercase: true, trim: true }], default: [] },
    description: { type: String, trim: true, maxlength: 600, default: "" },
    icon: { type: String, enum: PRODUCT_TYPE_ICONS, default: "package" },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0, min: 0, max: 100000 },
    fields: { type: [fieldSchema], default: [], validate: maxItems(MAX_TYPE_FIELDS, "product details") },
    options: { type: [optionSchema], default: [], validate: maxItems(MAX_TYPE_OPTIONS, "options") },
    sizeChart: { type: sizeChartSchema, default: null },
    defaults: {
      hsnCode: { type: String, trim: true, maxlength: 8, default: "", match: /^(\d{4}|\d{6}|\d{8})?$/ },
      gstRatePercent: { type: Number, min: 0, max: 28, default: null },
      minimumOrderQuantity: { type: Number, min: 1, max: 100000, default: 1 },
      careInstructions: { type: String, trim: true, maxlength: 2000, default: "" },
    },
    /** The template it was created from, if any (lib/catalog/type-templates.js). */
    template: { type: String, trim: true, maxlength: 40, default: "" },
  },
  { timestamps: true },
);

productTypeSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
productTypeSchema.index({ tenantId: 1, previousSlugs: 1 });
productTypeSchema.index({ tenantId: 1, isActive: 1, sortOrder: 1 });

productTypeSchema.post(
  ["save", "updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "findOneAndDelete"],
  () => invalidateCatalogCache(),
);
productTypeSchema.plugin(tenantScopePlugin);

export const ProductType = mongoose.models.ProductType ?? mongoose.model("ProductType", productTypeSchema);
