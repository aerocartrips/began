import "server-only";

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { domain } from "next/root-params";
import { ApiError } from "@/lib/utils/api-error";
import { normalizeHost } from "@/lib/tenant/host";
import { getTenantByDomain } from "@/lib/tenant/resolve";
import { runWithTenant } from "@/lib/tenant/context";

/**
 * Store for the current Server Component render, from the `[domain]` root
 * segment that proxy.ts rewrites every page request into. Cached per domain.
 * @returns {Promise<import("@/lib/tenant/types").PublicTenant>}
 */
export async function getCurrentTenant() {
  const hostname = normalizeHost(await domain());
  const tenant = hostname ? await getTenantByDomain(hostname) : null;
  if (!tenant) notFound();
  return tenant;
}

/**
 * Runs `callback` with the current store's tenant context (Server Components).
 * @template T
 * @param {(tenant: import("@/lib/tenant/types").PublicTenant) => Promise<T> | T} callback
 * @returns {Promise<T>}
 */
export async function withCurrentTenant(callback) {
  const tenant = await getCurrentTenant();
  return runWithTenant(tenant, () => callback(tenant));
}

/**
 * Store for a Route Handler request, from its Host header.
 * @param {string | null} host
 */
export async function getRequestTenant(host) {
  return resolveHostOrThrow(host);
}

/** Store for a Server Action (root params are unavailable there). */
export async function getActionTenant() {
  return resolveHostOrThrow((await headers()).get("host"));
}

/**
 * @param {string | null} host
 */
async function resolveHostOrThrow(host) {
  const hostname = normalizeHost(host);
  const tenant = hostname ? await getTenantByDomain(hostname) : null;
  if (!tenant) throw new ApiError(404, "Store not found.");
  return tenant;
}
