import { revalidateTag } from "next/cache";
import { getTenantContext } from "@/lib/tenant/context";

/** Cache tag for one store's home page layout. */
export const homepageCacheTag = (tenantId) => `homepage:${tenantId}`;

/**
 * Marks a store's cached home page layout stale (defaults to the current tenant).
 * No-op outside a Next.js request (scripts, tests).
 * @param {string} [tenantId]
 */
export function invalidateHomepageCache(tenantId = getTenantContext()?.tenantId) {
  if (!tenantId) return;
  try {
    revalidateTag(homepageCacheTag(tenantId), { expire: 0 });
  } catch {
    // Not running inside a Next.js server context.
  }
}
