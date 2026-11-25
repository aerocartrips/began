import { cacheLife, cacheTag } from "next/cache";
import { connectDB, isDatabaseConfigured } from "@/lib/db/connect";
import { HomepageLayout } from "@/lib/db/models/HomepageLayout";
import { runWithTenant } from "@/lib/tenant/context";
import { homepageCacheTag } from "@/lib/content/homepage-cache";
import { defaultHomeSections, normalizeHomeSections, refreshLegacyCopy } from "@/lib/content/homepage-defaults";
import { toHomeSections } from "@/lib/services/homepage.service";
import { catalogCacheTag } from "@/lib/catalog/catalog-cache";
import { getCatalogConfig, sellsSareesOnly } from "@/lib/catalog/catalog-config";

/**
 * The store's enabled home page sections in display order. Cached per store
 * and refreshed as soon as an admin saves the layout.
 * @param {string} tenantId
 * @returns {Promise<import("@/features/homepage/types").HomeSection[]>}
 */
export async function getHomepageSections(tenantId) {
  "use cache";
  cacheLife("hours");
  // Also refreshed when what the store sells changes (the copy depends on it).
  cacheTag(homepageCacheTag(tenantId), catalogCacheTag(tenantId));
  if (!isDatabaseConfigured()) return defaultHomeSections();

  await connectDB();
  const [doc, config] = await Promise.all([runWithTenant(tenantId, () => HomepageLayout.findOne({}).lean()), getCatalogConfig(tenantId)]);
  const sections = doc ? refreshLegacyCopy(normalizeHomeSections(toHomeSections(doc)), sellsSareesOnly(config)) : defaultHomeSections();
  return sections.filter((section) => section.enabled && (section.showOnMobile || section.showOnDesktop));
}
