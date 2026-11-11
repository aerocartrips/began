import { storeOriginFor } from "@/lib/tenant/host";

/**
 * Canonical origin of a store: its primary domain (the first entry in
 * Tenant.domains). Every canonical URL, sitemap entry and structured-data URL
 * uses it, whichever of the store's domains the request came in on, so search
 * engines consolidate all of them onto one site.
 * @param {{ primaryDomain: string }} tenant
 */
export function storeOrigin(tenant) {
  // The port only applies to development hosts (a store whose primary domain is localhost).
  return storeOriginFor(tenant.primaryDomain, process.env.PORT || 3000);
}

/**
 * Absolute URL for a path on the store's primary domain.
 * @param {{ primaryDomain: string }} tenant
 * @param {string} [path] starts with "/"
 */
export function absoluteUrl(tenant, path = "/") {
  return `${storeOrigin(tenant)}${path.startsWith("/") ? path : `/${path}`}`;
}
