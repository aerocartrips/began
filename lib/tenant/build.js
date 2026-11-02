import { isDatabaseConfigured } from "@/lib/db/connect";
import { listActiveTenants } from "@/lib/tenant/resolve";
import { logger } from "@/lib/utils/logger";
import { BUILD_PLACEHOLDER_DOMAIN } from "@/lib/tenant/host";

/**
 * Hostnames to prerender at build time. Unlisted hosts still render on demand.
 * @returns {Promise<string[]>}
 */
export async function listBuildTimeDomains() {
  if (isDatabaseConfigured()) {
    try {
      const domains = (await listActiveTenants()).map((tenant) => tenant.primaryDomain);
      if (domains.length) return domains;
    } catch (error) {
      logger.warn("Could not list stores at build time", { error });
    }
  }
  return [BUILD_PLACEHOLDER_DOMAIN];
}
