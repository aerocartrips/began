import { revalidateTag } from "next/cache";
import { getTenantContext } from "@/lib/tenant/context";

/** Cache tag for one store's published guides. */
export const guidesCacheTag = (tenantId) => `guides:${tenantId}`;

/**
 * Marks a store's cached guides stale (defaults to the current tenant).
 * No-op outside a Next.js request (scripts, tests).
 * @param {string} [tenantId]
 */
export function invalidateGuidesCache(tenantId = getTenantContext()?.tenantId) {
  if (!tenantId) return;
  try {
    revalidateTag(guidesCacheTag(tenantId), { expire: 0 });
  } catch {
    // Not running inside a Next.js server context.
  }
}
