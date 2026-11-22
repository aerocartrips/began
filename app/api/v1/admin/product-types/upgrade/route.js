import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { ensureCatalogIndexes, upgradeLegacyCatalog } from "@/lib/services/catalog-upgrade.service";

/** What the catalogue upgrade would change (nothing is written). */
export const GET = withDatabase(async () => {
  await requireAdminAccess(PERMISSIONS.SETTINGS_MANAGE);
  return successResponse(await upgradeLegacyCatalog({ apply: false }), "Upgrade plan.");
});

/** Upgrades the store's products without a type (lib/services/catalog-upgrade.service.js). */
export const POST = withDatabase(async () => {
  await requireAdminAccess(PERMISSIONS.SETTINGS_MANAGE);
  const result = await upgradeLegacyCatalog({ apply: true });
  await ensureCatalogIndexes();
  return successResponse(result, `${result.converted} products upgraded.`);
});
