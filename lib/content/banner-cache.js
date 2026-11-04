import { revalidateTag } from "next/cache";
import { getTenantContext } from "@/lib/tenant/context";

/** Cache tag for one store's live banners. */
export const bannerCacheTag = (tenantId) => `banners:${tenantId}`;

/**
 * Marks a store's cached banners stale (defaults to the current tenant).
 * No-op outside a Next.js request (scripts, tests).
 * @param {string} [tenantId]
 */
export function invalidateBannerCache(tenantId = getTenantContext()?.tenantId) {
  if (!tenantId) return;
  try {
    revalidateTag(bannerCacheTag(tenantId), { expire: 0 });
  } catch {
    // Not running inside a Next.js server context.
  }
}
