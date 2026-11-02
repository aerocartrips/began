import { beforeEach } from "vitest";
import { enterTenantContext } from "@/lib/tenant/context";

/**
 * Creates the store served at http://localhost (the host used by test requests)
 * and enters its tenant context so test code can use models directly.
 * @param {Partial<Record<string, unknown>>} [overrides]
 */
export async function createTestTenant(overrides = {}) {
  const { Tenant } = await import("@/lib/db/models/Tenant");
  const tenant = await Tenant.create({
    slug: "test-store",
    name: "Test Store",
    domains: ["localhost"],
    ...overrides,
  });
  const tenantId = String(tenant._id);
  enterTenantContext(tenantId);
  return { tenant, tenantId };
}

/**
 * Re-enters the tenant before every test (each test runs in a fresh async flow).
 * @param {() => string | undefined} getTenantId
 */
export function enterTenantBeforeEach(getTenantId) {
  beforeEach(() => {
    const tenantId = getTenantId();
    if (tenantId) enterTenantContext(tenantId);
  });
}
