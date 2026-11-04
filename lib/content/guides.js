import { cacheLife, cacheTag } from "next/cache";
import { connectDB, isDatabaseConfigured } from "@/lib/db/connect";
import { GUIDE_STATUS, Guide } from "@/lib/db/models/Guide";
import { runWithTenant } from "@/lib/tenant/context";
import { guidesCacheTag } from "@/lib/content/guides-cache";
import { readingMinutes } from "@/lib/services/guide.service";

/**
 * Published buying guides for the storefront, cached per store and refreshed
 * whenever a guide is saved.
 * @typedef {import("@/features/guides/types").GuideSummary} GuideSummary
 * @typedef {import("@/features/guides/types").GuideArticle} GuideArticle
 */

const summary = (doc) => ({
  id: String(doc._id),
  title: doc.title,
  slug: doc.slug,
  excerpt: doc.excerpt ?? "",
  coverImage: doc.coverImage?.url ? { url: doc.coverImage.url, publicId: doc.coverImage.publicId ?? "", width: doc.coverImage.width, height: doc.coverImage.height } : null,
  coverAlt: doc.coverAlt ?? "",
  publishedAt: new Date(doc.publishedAt ?? doc.createdAt).toISOString(),
  updatedAt: new Date(doc.updatedAt).toISOString(),
  readingMinutes: readingMinutes(doc.sections),
});

/**
 * @param {string} tenantId
 * @param {{ limit?: number, withCover?: boolean }} [options] withCover: only guides with a cover photo (home page)
 * @returns {Promise<GuideSummary[]>}
 */
export async function getPublishedGuides(tenantId, { limit = 50, withCover = false } = {}) {
  "use cache";
  cacheLife("hours");
  cacheTag(guidesCacheTag(tenantId));
  if (!isDatabaseConfigured()) return [];

  await connectDB();
  const docs = await runWithTenant(tenantId, () =>
    Guide.find({ status: GUIDE_STATUS.PUBLISHED, ...(withCover ? { "coverImage.url": { $exists: true, $ne: "" } } : {}) })
      .sort({ publishedAt: -1, _id: -1 })
      .limit(Math.min(limit, 100))
      .select("title slug excerpt coverImage coverAlt publishedAt createdAt updatedAt sections")
      .lean(),
  );
  return docs.map(summary);
}

/**
 * @param {string} tenantId
 * @param {string} slug
 * @returns {Promise<GuideArticle | null>}
 */
export async function getPublishedGuide(tenantId, slug) {
  "use cache";
  cacheLife("hours");
  cacheTag(guidesCacheTag(tenantId));
  if (!isDatabaseConfigured()) return null;

  await connectDB();
  const doc = await runWithTenant(tenantId, () => Guide.findOne({ slug: slug.toLowerCase(), status: GUIDE_STATUS.PUBLISHED }).lean());
  return doc ? { ...summary(doc), sections: doc.sections.map(({ heading, body }) => ({ heading, body })) } : null;
}
