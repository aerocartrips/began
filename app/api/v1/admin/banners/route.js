import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { createBanner, listBanners } from "@/lib/services/banner.service";

export const GET = withDatabase(async () => {
  await requireAdminAccess(PERMISSIONS.MARKETING_MANAGE);
  return successResponse(await listBanners(), "Banners fetched.");
});

export const POST = withDatabase(async (request) => {
  const { user } = await requireAdminAccess(PERMISSIONS.MARKETING_MANAGE);
  return successResponse(await createBanner(await parseJsonBody(request), user), "Banner created.", undefined, 201);
});
