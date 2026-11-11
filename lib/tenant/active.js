import { getTenantContext, requireTenantId } from "@/lib/tenant/context";
import { getTenantById } from "@/lib/tenant/resolve";
import { storeOriginFor } from "@/lib/tenant/host";

/**
 * The store for the current tenant context (sales mode, branding, business
 * details). Uses the tenant attached by withDatabase / runForEachTenant when
 * present, otherwise loads it (cached).
 * @returns {Promise<import("@/lib/tenant/types").PublicTenant>}
 */
export async function getActiveTenant() {
  const context = getTenantContext();
  if (context?.tenant) return context.tenant;
  const tenant = await getTenantById(requireTenantId());
  if (!tenant) throw new Error("The current store is not active.");
  return tenant;
}

/**
 * Absolute origin for links in emails and notifications. During a request it
 * is the store domain the shopper is on (withDatabase only records a host that
 * resolved to this store, never a forged one), so links work on every domain
 * of the store, and on localhost in development. Jobs without a request use
 * the store's primary domain.
 */
export async function getStoreOrigin() {
  const origin = getTenantContext()?.origin;
  if (origin) return origin;
  const { primaryDomain } = await getActiveTenant();
  return storeOriginFor(primaryDomain, process.env.PORT || 3000);
}
