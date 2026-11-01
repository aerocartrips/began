import { revalidateTag } from "next/cache";

export const CATALOG_CACHE_TAG = "storefront-catalog";

/**
 * Marks the cached storefront catalog stale. No-op outside a Next.js request
 * (scripts, unit tests), where there is no cache to invalidate.
 */
export function invalidateCatalogCache() {
  try {
    revalidateTag(CATALOG_CACHE_TAG, { expire: 0 });
  } catch {
    // Not running inside a Next.js server context.
  }
}
