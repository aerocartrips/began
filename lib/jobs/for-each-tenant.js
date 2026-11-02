import { runWithTenant } from "@/lib/tenant/context";
import { listActiveTenants } from "@/lib/tenant/resolve";
import { logger } from "@/lib/utils/logger";

/**
 * Runs a job once per active store, each inside its own tenant context.
 * One store failing does not stop the others.
 * @template T
 * @param {string} jobName
 * @param {(tenant: import("@/lib/tenant/types").PublicTenant) => Promise<T>} job
 */
export async function runForEachTenant(jobName, job) {
  const tenants = await listActiveTenants();
  const results = [];
  for (const tenant of tenants) {
    try {
      const result = await runWithTenant(tenant, () => job(tenant));
      results.push({ tenant: tenant.slug, status: "success", result });
    } catch (error) {
      logger.error("Scheduled job failed for store", { jobName, tenant: tenant.slug, error });
      results.push({ tenant: tenant.slug, status: "failed", error: String(error?.message ?? error) });
    }
  }
  return results;
}
