import { cacheLife, cacheTag } from "next/cache";
import { connectDB, isDatabaseConfigured } from "@/lib/db/connect";
import { Banner } from "@/lib/db/models/Banner";
import { runWithTenant } from "@/lib/tenant/context";
import { bannerCacheTag } from "@/lib/content/banner-cache";

/**
 * @typedef {import("@/features/banners/types").StorefrontBanner} StorefrontBanner
 */

/**
 * Banners currently live on a store's home page, in rotation order. Cached per
 * store for a few minutes (so start/end schedules apply within minutes) and
 * refreshed immediately when an admin edits banners.
 * @param {string} tenantId
 * @returns {Promise<StorefrontBanner[]>}
 */
export async function getLiveBanners(tenantId) {
  "use cache";
  cacheLife("minutes");
  cacheTag(bannerCacheTag(tenantId));
  if (!isDatabaseConfigured()) return [];

  await connectDB();
  const now = new Date();
  const docs = await runWithTenant(tenantId, () =>
    Banner.find({
      isActive: true,
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] },
      ],
    })
      .sort({ sortOrder: 1, createdAt: 1 })
      .limit(10)
      .lean(),
  );

  return docs.map((doc) => ({
    id: String(doc._id),
    eyebrow: doc.eyebrow ?? "",
    title: doc.title,
    subtitle: doc.subtitle ?? "",
    primaryCta: doc.primaryCta?.label && doc.primaryCta?.href ? doc.primaryCta : null,
    secondaryCta: doc.secondaryCta?.label && doc.secondaryCta?.href ? doc.secondaryCta : null,
    image: { url: doc.image.url, width: doc.image.width, height: doc.image.height },
    mobileImage: doc.mobileImage?.url ? { url: doc.mobileImage.url, width: doc.mobileImage.width, height: doc.mobileImage.height } : null,
    imageAlt: doc.imageAlt ?? "",
    textPosition: doc.textPosition,
    textTone: doc.textTone,
    overlayOpacity: doc.overlayOpacity,
  }));
}
