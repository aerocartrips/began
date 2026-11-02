import { getTenantContext, requireTenantId } from "@/lib/tenant/context";
import { getTenantById } from "@/lib/tenant/resolve";

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
 * Absolute origin of the current store (its primary domain), for links in
 * emails and payment callbacks. Never derived from the request's Host header.
 */
export async function getStoreOrigin() {
  const { primaryDomain } = await getActiveTenant();
  const isLocal = primaryDomain === "localhost" || /^127\.|^\[?::1\]?$/.test(primaryDomain);
  const port = isLocal && process.env.PORT ? `:${process.env.PORT}` : isLocal ? ":3000" : "";
  return `${isLocal ? "http" : "https"}://${primaryDomain}${port}`;
}
