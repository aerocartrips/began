import { z } from "zod";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { connectDB } from "@/lib/db/connect";
import { StorePage } from "@/lib/db/models/StorePage";
import { getStoreSettingsDocument } from "@/lib/db/models/StoreSettings";
import { ApiError } from "@/lib/utils/api-error";
import { formatZodErrors } from "@/lib/validators/auth.validator";
import { runWithTenant } from "@/lib/tenant/context";
import { getActiveTenant } from "@/lib/tenant/active";
import { getTenantById } from "@/lib/tenant/resolve";
import { STORE_PAGES, defaultStorePage } from "@/lib/content/store-pages";

const pagesTag = (tenantId) => `pages:${tenantId}`;

/** @returns {import("@/lib/content/types").StorePageContent} */
const toPlain = (doc) => ({
  slug: doc.slug,
  title: doc.title,
  summary: doc.summary ?? "",
  sections: (doc.sections ?? []).map(({ heading, body }) => ({ heading, body })),
  faqs: (doc.faqs ?? []).map(({ question, answer }) => ({ question, answer })),
  isDefault: false,
  updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
});

/**
 * A store's content page: its edited version, or the default template.
 * @param {string} tenantId
 * @param {string} slug
 * @returns {Promise<import("@/lib/content/types").StorePageContent | null>}
 */
export async function getStorePage(tenantId, slug) {
  "use cache";
  cacheLife("hours");
  cacheTag(pagesTag(tenantId));
  if (!STORE_PAGES[slug]) return null;

  await connectDB();
  return runWithTenant(tenantId, async () => {
    const saved = await StorePage.findOne({ slug }).lean();
    if (saved) return toPlain(saved);
    const [tenant, settings] = await Promise.all([getTenantById(tenantId), getStoreSettingsDocument()]);
    return defaultStorePage(slug, {
      name: tenant?.name ?? "our store",
      salesMode: tenant?.salesMode ?? "wholesale",
      contactEmail: tenant?.contact.email ?? "",
      returnWindowDays: settings.orders.returnWindowDays,
      cancellationWindowHours: settings.orders.cancellationWindowHours,
    });
  });
}

const pageSchema = z.object({
  title: z.string().trim().min(2).max(160),
  summary: z.string().trim().max(400).default(""),
  sections: z.array(z.object({ heading: z.string().trim().min(1).max(160), body: z.string().trim().min(1).max(8000) })).max(40).default([]),
  faqs: z.array(z.object({ question: z.string().trim().min(1).max(300), answer: z.string().trim().min(1).max(4000) })).max(80).default([]),
});

/** Saves the current store's edited page. */
export async function saveStorePage(slug, payload, adminUser) {
  if (!STORE_PAGES[slug]) throw new ApiError(404, "Unknown page.");
  const parsed = pageSchema.safeParse(payload);
  if (!parsed.success) throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  const doc = await StorePage.findOneAndUpdate(
    { slug },
    { $set: { ...parsed.data, updatedBy: adminUser._id }, $setOnInsert: { slug } },
    { upsert: true, returnDocument: "after", runValidators: true },
  ).lean();
  revalidateTag(pagesTag((await getActiveTenant()).id), { expire: 0 });
  return toPlain(doc);
}

/** Removes the store's edits so the default template is shown again. */
export async function resetStorePage(slug) {
  if (!STORE_PAGES[slug]) throw new ApiError(404, "Unknown page.");
  await StorePage.deleteOne({ slug });
  revalidateTag(pagesTag((await getActiveTenant()).id), { expire: 0 });
  return { reset: true };
}
