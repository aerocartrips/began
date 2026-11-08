import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess, requireAdminUser } from "@/lib/auth/admin-access";
import { getStoreSettings, updateStoreSettings } from "@/lib/services/store-settings.service";

export const GET = withDatabase(async () => {
  await requireAdminAccess(PERMISSIONS.SETTINGS_MANAGE);
  const settings = await getStoreSettings();
  return successResponse(settings, "Store settings fetched.");
});

export const PATCH = withDatabase(async (request) => {
  const admin = await requireAdminUser(PERMISSIONS.SETTINGS_MANAGE);
  const payload = await parseJsonBody(request);
  const settings = await updateStoreSettings(admin, payload);
  return successResponse(settings, "Store settings updated.");
});
