import { z } from "zod";
import {
  COLLECTION_SORTS,
  COLLECTION_SOURCE_KINDS,
  HOME_SECTION_TYPES,
  HOME_SECTION_TYPE_VALUES,
  MAX_COLLECTIONS,
  MAX_HOME_SECTIONS,
  MAX_SECTION_PRODUCTS,
  PRODUCT_TAB_KEYS,
  TRUST_ICONS,
} from "@/lib/constants/homepage";
import { ctaLinkSchema, safeHrefSchema } from "@/lib/validators/banner.validator";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid product id.");

const sourceSchema = z.object({
  kind: z.enum(COLLECTION_SOURCE_KINDS),
  value: z.string().trim().max(120).default(""),
  productIds: z.array(objectId).max(MAX_SECTION_PRODUCTS).default([]),
  sort: z.enum(COLLECTION_SORTS).default("popular"),
});

const trustItemSchema = z.object({
  icon: z.enum(TRUST_ICONS).default("badge"),
  title: z.string().trim().min(1, "Give each point a title.").max(60),
  text: z.string().trim().max(140).default(""),
});

const sectionSchema = z
  .object({
    key: z.string().trim().regex(/^[a-z0-9-]{1,40}$/, "Invalid section key."),
    type: z.enum(HOME_SECTION_TYPE_VALUES),
    enabled: z.boolean().default(true),
    title: z.string().trim().max(80).default(""),
    description: z.string().trim().max(240).default(""),
    limit: z.number().int().min(4).max(MAX_SECTION_PRODUCTS).default(10),
    viewAllHref: safeHrefSchema.default(""),
    showOnMobile: z.boolean().default(true),
    showOnDesktop: z.boolean().default(true),
    source: sourceSchema.optional(),
    tabs: z.array(z.enum(PRODUCT_TAB_KEYS)).min(1, "Keep at least one tab.").max(PRODUCT_TAB_KEYS.length).optional(),
    items: z.array(trustItemSchema).max(6).optional(),
    primaryCta: ctaLinkSchema.optional(),
    secondaryCta: ctaLinkSchema.optional(),
  })
  .superRefine((section, context) => {
    if (section.type !== HOME_SECTION_TYPES.COLLECTION) return;
    if (!section.title) context.addIssue({ code: "custom", path: ["title"], message: "Give the collection a heading." });
    const source = section.source;
    if (!source) {
      context.addIssue({ code: "custom", path: ["source"], message: "Choose where the collection's products come from." });
    } else if (source.kind === "products" ? source.productIds.length === 0 : !source.value) {
      context.addIssue({
        code: "custom",
        path: ["source"],
        message: source.kind === "products" ? "Pick at least one product." : "Choose a value for the collection.",
      });
    }
  });

export const homepageLayoutSchema = z
  .object({ sections: z.array(sectionSchema).min(1).max(MAX_HOME_SECTIONS) })
  .superRefine(({ sections }, context) => {
    const keys = new Set();
    const singletons = new Set();
    let collections = 0;
    sections.forEach((section, index) => {
      if (keys.has(section.key)) context.addIssue({ code: "custom", path: ["sections", index, "key"], message: "Section keys must be unique." });
      keys.add(section.key);
      if (section.type === HOME_SECTION_TYPES.COLLECTION) {
        collections += 1;
      } else if (singletons.has(section.type)) {
        context.addIssue({ code: "custom", path: ["sections", index, "type"], message: "This section can appear only once." });
      } else {
        singletons.add(section.type);
      }
    });
    if (collections > MAX_COLLECTIONS) {
      context.addIssue({ code: "custom", path: ["sections"], message: `Use at most ${MAX_COLLECTIONS} collections.` });
    }
  });
