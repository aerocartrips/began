import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { getAdminHomepageLayout, resetHomepageLayout, saveHomepageLayout } from "@/lib/services/homepage.service";

export const GET = withDatabase(async () => {
  await requireAdminAccess(PERMISSIONS.MARKETING_MANAGE);
  return successResponse(await getAdminHomepageLayout(), "Home page layout fetched.");
});

export const PUT = withDatabase(async (request) => {
  const { user } = await requireAdminAccess(PERMISSIONS.MARKETING_MANAGE);
  return successResponse(await saveHomepageLayout(await parseJsonBody(request, 128 * 1024), user), "Home page saved.");
});

/** Restores the default layout. */
export const DELETE = withDatabase(async () => {
  await requireAdminAccess(PERMISSIONS.MARKETING_MANAGE);
  return successResponse(await resetHomepageLayout(), "Home page reset to the default layout.");
});
