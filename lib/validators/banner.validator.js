import { z } from "zod";

/** Same-site paths ("/products?fabric=Silk") or https URLs; never javascript:/data: links. */
const href = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => value === "" || (value.startsWith("/") && !value.startsWith("//")) || /^https:\/\/[^\s]+$/i.test(value), {
    message: "Use a page path like /products or a full https:// link.",
  });

const link = z
  .object({ label: z.string().trim().max(40).default(""), href: href.default("") })
  .refine((value) => Boolean(value.label) === Boolean(value.href), {
    message: "Add both a button label and a link, or leave both empty.",
  });

const image = z.object({
  url: z.string().trim().url().max(2048).refine((value) => value.startsWith("https://"), "Images must use https."),
  publicId: z.string().trim().max(260).default(""),
  width: z.number().int().min(1).max(10000).default(1920),
  height: z.number().int().min(1).max(10000).default(800),
});

const bannerShape = {
  name: z.string().trim().min(1, "Give the banner a name.").max(120),
  eyebrow: z.string().trim().max(60).default(""),
  title: z.string().trim().min(1, "Add a headline.").max(120),
  subtitle: z.string().trim().max(280).default(""),
  primaryCta: link.default({ label: "", href: "" }),
  secondaryCta: link.default({ label: "", href: "" }),
  image,
  mobileImage: image.nullable().default(null),
  imageAlt: z.string().trim().max(160).default(""),
  textPosition: z.enum(["left", "center", "right"]).default("left"),
  textTone: z.enum(["light", "dark"]).default("light"),
  overlayOpacity: z.number().int().min(0).max(80).default(35),
  startsAt: z.coerce.date().nullable().default(null),
  endsAt: z.coerce.date().nullable().default(null),
  isActive: z.boolean().default(true),
};

const scheduleIsValid = (value) => !value.startsAt || !value.endsAt || value.startsAt < value.endsAt;
const scheduleIssue = { message: "The end date must be after the start date.", path: ["endsAt"] };

export const createBannerSchema = z.object(bannerShape).refine(scheduleIsValid, scheduleIssue);

/** Partial update without defaults, so omitted fields stay as they are. */
export const updateBannerSchema = z
  .object(Object.fromEntries(Object.entries(bannerShape).map(([key, schema]) => [key, schema.removeDefault?.() ?? schema])))
  .partial()
  .refine(scheduleIsValid, scheduleIssue);

export const reorderBannersSchema = z.object({
  ids: z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1).max(100),
});
