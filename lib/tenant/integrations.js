import { requireTenantId } from "@/lib/tenant/context";
import { getTenantIntegrations } from "@/lib/tenant/resolve";

const TTL_MS = 60 * 1000;
/** @type {Map<string, { value: Awaited<ReturnType<typeof getTenantIntegrations>>, expiresAt: number }>} */
const cache = new Map();

/**
 * Decrypted credentials for the store in the current tenant context. Kept in
 * process memory for a minute so payment flows do not re-read the tenant on
 * every call; never serialised or sent to clients.
 */
export async function getCurrentIntegrations() {
  const tenantId = requireTenantId();
  const hit = cache.get(tenantId);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const value = await getTenantIntegrations(tenantId);
  cache.set(tenantId, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}

/** Drop cached credentials after a store's integrations are edited. */
export function forgetIntegrations(tenantId) {
  cache.delete(tenantId);
}
