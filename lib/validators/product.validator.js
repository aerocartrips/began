import { z } from "zod";
import { PRODUCT_STATUS_VALUES } from "@/lib/constants/product-status";

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

const variantSchema = z.object({
  _id: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  colorName: z.string().trim().min(1).max(60),
  colorHex: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a #RRGGBB colour."),
  sku: z.string().trim().min(2).max(64),
  stockQuantity: z.number().int().min(0),
  images: z.array(imageSchema).max(12).optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(2).max(180),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens.").max(160).optional(),
  sku: z.string().trim().min(2).max(64),
  description: z.string().trim().max(10000).optional(),
  shortDescription: z.string().trim().max(400).optional(),
  category: z.string().trim().min(1),
  images: z.array(imageSchema).max(20).optional(),
  fabric: z.string().trim().max(80).optional(),
  weavingType: z.string().trim().max(80).optional(),
  sareeLength: z.string().trim().max(40).optional(),
  blousePiece: z.string().trim().max(40).optional(),
  colors: z.array(z.string().trim().max(40)).max(20).optional(),
  design: z.string().trim().max(120).optional(),
  occasion: z.string().trim().max(120).optional(),
  careInstructions: z.string().trim().max(2000).optional(),
  variants: z.array(variantSchema).max(30).optional(),
  hsnCode: z.string().trim().regex(/^(\d{4}|\d{6}|\d{8})?$/, "HSN codes have 4, 6 or 8 digits.").optional(),
  gstRatePercent: z.number().min(0).max(28).nullable().optional(),
  price: z.number().min(0),
  compareAtPrice: z.number().min(0).optional(),
  wholesalePrice: z.number().min(0),
  bulkPricingTiers: z.array(bulkTierSchema).max(10).optional(),
  minimumOrderQuantity: z.number().int().min(1).optional(),
  stockQuantity: z.number().int().min(0).optional(),
  status: z.enum(PRODUCT_STATUS_VALUES).optional(),
  featured: z.boolean().optional(),
  seoTitle: z.string().trim().max(160).optional(),
  seoDescription: z.string().trim().max(320).optional(),
});

const withUniqueVariantSkus = (schema) =>
  schema.superRefine((value, ctx) => {
    const skus = (value.variants ?? []).map((variant) => variant.sku.toUpperCase());
    if (new Set(skus).size !== skus.length) {
      ctx.addIssue({ code: "custom", path: ["variants"], message: "Each colour needs its own SKU." });
    }
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
  fabric: z.string().trim().max(80).optional(),
  weavingType: z.string().trim().max(80).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  availability: z.enum(["in_stock", "out_of_stock"]).optional(),
  status: z.enum(PRODUCT_STATUS_VALUES).optional(),
  sortBy: z.enum(["price", "newest", "popularity"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});
