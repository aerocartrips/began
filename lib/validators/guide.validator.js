import { z } from "zod";
import { GUIDE_STATUS } from "@/lib/db/models/Guide";

const image = z.object({
  url: z.string().trim().url().max(2048).refine((value) => value.startsWith("https://"), "Images must use https."),
  publicId: z.string().trim().max(260).default(""),
  width: z.number().int().min(1).max(10000).default(1600),
  height: z.number().int().min(1).max(10000).default(900),
});

const shape = {
  title: z.string().trim().min(3, "Give the guide a title.").max(160),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(90)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens.")
    .optional(),
  excerpt: z.string().trim().max(300).default(""),
  coverImage: image.nullable().default(null),
  coverAlt: z.string().trim().max(160).default(""),
  sections: z
    .array(z.object({ heading: z.string().trim().min(1, "Each section needs a heading.").max(160), body: z.string().trim().min(1, "Each section needs text.").max(8000) }))
    .max(30)
    .default([]),
  status: z.enum(Object.values(GUIDE_STATUS)).default(GUIDE_STATUS.DRAFT),
};

const publishable = (value) => value.status !== GUIDE_STATUS.PUBLISHED || (value.sections?.length ?? 0) > 0;
const publishIssue = { message: "Add at least one section before publishing.", path: ["sections"] };

export const createGuideSchema = z.object(shape).refine(publishable, publishIssue);

/** Partial update without defaults, so omitted fields stay as they are. */
export const updateGuideSchema = z
  .object(Object.fromEntries(Object.entries(shape).map(([key, schema]) => [key, schema.removeDefault?.() ?? schema])))
  .partial();
