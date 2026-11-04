import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { createGuide, listGuides } from "@/lib/services/guide.service";

export const GET = withDatabase(async () => {
  await requireAdminAccess(PERMISSIONS.MARKETING_MANAGE);
  return successResponse(await listGuides(), "Guides fetched.");
});

export const POST = withDatabase(async (request) => {
  const { user } = await requireAdminAccess(PERMISSIONS.MARKETING_MANAGE);
  return successResponse(await createGuide(await parseJsonBody(request, 256 * 1024), user), "Guide created.", undefined, 201);
});
