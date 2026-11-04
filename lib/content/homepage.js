import { cacheLife, cacheTag } from "next/cache";
import { connectDB, isDatabaseConfigured } from "@/lib/db/connect";
import { HomepageLayout } from "@/lib/db/models/HomepageLayout";
import { runWithTenant } from "@/lib/tenant/context";
import { homepageCacheTag } from "@/lib/content/homepage-cache";
import { defaultHomeSections, normalizeHomeSections } from "@/lib/content/homepage-defaults";
import { toHomeSections } from "@/lib/services/homepage.service";

/**
 * The store's enabled home page sections in display order. Cached per store
 * and refreshed as soon as an admin saves the layout.
 * @param {string} tenantId
 * @returns {Promise<import("@/features/homepage/types").HomeSection[]>}
 */
export async function getHomepageSections(tenantId) {
  "use cache";
  cacheLife("hours");
  cacheTag(homepageCacheTag(tenantId));
  if (!isDatabaseConfigured()) return defaultHomeSections();

  await connectDB();
  const doc = await runWithTenant(tenantId, () => HomepageLayout.findOne({}).lean());
  const sections = doc ? normalizeHomeSections(toHomeSections(doc)) : defaultHomeSections();
  return sections.filter((section) => section.enabled && (section.showOnMobile || section.showOnDesktop));
}
