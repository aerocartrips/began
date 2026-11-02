import { revalidateTag } from "next/cache";
import { getTenantContext } from "@/lib/tenant/context";

/** Cache tag for one store's catalog. */
export const catalogCacheTag = (tenantId) => `catalog:${tenantId}`;

/**
 * Marks a store's cached catalog stale (defaults to the current tenant).
 * No-op outside a Next.js request (scripts, unit tests), where there is no cache.
 * @param {string} [tenantId]
 */
export function invalidateCatalogCache(tenantId = getTenantContext()?.tenantId) {
  if (!tenantId) return;
  try {
    revalidateTag(catalogCacheTag(tenantId), { expire: 0 });
  } catch {
    // Not running inside a Next.js server context.
  }
}
