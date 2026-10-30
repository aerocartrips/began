import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireCommerceAdmin } from "@/lib/middleware/admin-api";
import { getStoreSettings, updateStoreSettings } from "@/lib/services/store-settings.service";

export const GET = withDatabase(async () => {
  await requireCommerceAdmin();
  const settings = await getStoreSettings();
  return successResponse(settings, "Store settings fetched.");
});

export const PATCH = withDatabase(async (request) => {
  const admin = await requireCommerceAdmin();
  const payload = await parseJsonBody(request);
  const settings = await updateStoreSettings(admin, payload);
  return successResponse(settings, "Store settings updated.");
});
