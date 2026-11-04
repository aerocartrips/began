import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { reorderBanners } from "@/lib/services/banner.service";

/** Body: { ids: string[] } in the new display order. */
export const PUT = withDatabase(async (request) => {
  await requireAdminAccess(PERMISSIONS.MARKETING_MANAGE);
  return successResponse(await reorderBanners(await parseJsonBody(request)), "Order saved.");
});
