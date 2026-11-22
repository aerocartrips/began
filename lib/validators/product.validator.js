import { z } from "zod";
import { PRODUCT_STATUS_VALUES } from "@/lib/constants/product-status";
import { ATTRIBUTE_KEY_PATTERN, MAX_PRODUCT_VARIANTS } from "@/lib/constants/catalog";
import { sizeChartInputSchema } from "@/lib/validators/catalog-setup.validator";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id.");
const attributeKey = z.string().regex(ATTRIBUTE_KEY_PATTERN, "Invalid attribute key.");

const imageSchema = z.object({
  url: z.string().url().max(2048),
  alt: z.string().trim().max(160).optional(),
  isPrimary: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
  publicId: z.string().trim().max(200).optional(),
});

const bulkTierSchema = z.object({
  minQuantity: z.number().int().min(1),
  pricePerUnit: z.number().min(0),
});

/** One combination of the type's options; validated against the type in lib/services/product.service.js. */
const variantSchema = z.object({
  _id: objectId.optional(),
  options: z.record(attributeKey, z.string().trim().max(80)).default({}),
  /** Swatch for this colour; defaults to the colour's swatch in the attribute library. */
  colorHex: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a #RRGGBB colour.").optional(),
  sku: z.string().trim().min(2, "Every variant needs a SKU.").max(64),
  barcode: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z-]{0,32}$/, "Barcodes have letters, digits and hyphens only.")
    .optional(),
  stockQuantity: z.number().int().min(0),
  /** Stock when the editor loaded this variant; see product.service.js updateProduct. */
  stockBaseline: z.number().int().min(0).optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

const colorMediaSchema = z.object({
  color: z.string().trim().min(1).max(80),
  images: z.array(imageSchema).max(12),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(2).max(180),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens.").max(160).optional(),
  sku: z.string().trim().min(2).max(64),
  productType: objectId,
  description: z.string().trim().max(10000).optional(),
  shortDescription: z.string().trim().max(400).optional(),
  category: z.string().trim().min(1),
  images: z.array(imageSchema).max(20).optional(),
  /** Detail values by attribute key; several values for multi-select attributes. */
  attributes: z.record(attributeKey, z.union([z.string().trim().max(200), z.array(z.string().trim().max(200)).max(50)])).optional(),
  careInstructions: z.string().trim().max(2000).optional(),
  variants: z.array(variantSchema).max(MAX_PRODUCT_VARIANTS, `Up to ${MAX_PRODUCT_VARIANTS} variants.`).optional(),
  colorMedia: z.array(colorMediaSchema).max(40).optional(),
  /** This product's own size chart; null to use its type's. */
  sizeChart: sizeChartInputSchema.nullable().optional(),
  hsnCode: z.string().trim().regex(/^(\d{4}|\d{6}|\d{8})?$/, "HSN codes have 4, 6 or 8 digits.").optional(),
  gstRatePercent: z.number().min(0).max(28).nullable().optional(),
  price: z.number().min(0),
  compareAtPrice: z.number().min(0).optional(),
  wholesalePrice: z.number().min(0),
  bulkPricingTiers: z.array(bulkTierSchema).max(10).optional(),
  minimumOrderQuantity: z.number().int().min(1).optional(),
  stockQuantity: z.number().int().min(0).optional(),
  /** Stock when the editor loaded the product; see product.service.js updateProduct. */
  stockBaseline: z.number().int().min(0).optional(),
  status: z.enum(PRODUCT_STATUS_VALUES).optional(),
  featured: z.boolean().optional(),
  seoTitle: z.string().trim().max(160).optional(),
  seoDescription: z.string().trim().max(320).optional(),
});

const withUniqueVariantSkus = (schema) =>
  schema.superRefine((value, ctx) => {
    const skus = (value.variants ?? []).map((variant) => variant.sku.toUpperCase());
    skus.forEach((sku, index) => {
      if (skus.indexOf(sku) !== index) ctx.addIssue({ code: "custom", path: ["variants", index, "sku"], message: `SKU ${sku} is used by another variant.` });
    });
  });

export const createProductInputSchema = withUniqueVariantSkus(createProductSchema);
export const updateProductSchema = withUniqueVariantSkus(createProductSchema.partial());

export const productImagesSchema = z.object({
  images: z.array(imageSchema).min(1).max(20),
});

export const productQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  admin: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => value === true || value === "true"),
  search: z.string().trim().max(120).optional(),
  category: z.string().trim().max(64).optional(),
  /** Product type id, or "none" for products without one (before the catalogue upgrade). */
  type: z.union([objectId, z.literal("none")]).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  availability: z.enum(["in_stock", "out_of_stock"]).optional(),
  status: z.enum(PRODUCT_STATUS_VALUES).optional(),
  sortBy: z.enum(["price", "newest", "popularity"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});
