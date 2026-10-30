import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  image: z
    .object({
      url: z.string().url().max(2048).optional(),
      alt: z.string().trim().max(160).optional(),
    })
    .optional(),
  parentCategory: z.string().trim().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

export const updateCategorySchema = createCategorySchema.partial();
