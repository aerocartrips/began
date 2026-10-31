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

export const createProductSchema = z.object({
  name: z.string().trim().min(2).max(180),
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

export const updateProductSchema = createProductSchema.partial();

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
