import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { deleteCloudinaryImages } from "@/lib/cloudinary/delete";
import { runAfterResponse } from "@/lib/utils/background";
import { deleteGuide, getGuide, updateGuide } from "@/lib/services/guide.service";

export const GET = withDatabase(async (_request, context) => {
  await requireAdminAccess(PERMISSIONS.MARKETING_MANAGE);
  const { guideId } = await context.params;
  return successResponse(await getGuide(guideId), "Guide fetched.");
});

export const PATCH = withDatabase(async (request, context) => {
  const { user } = await requireAdminAccess(PERMISSIONS.MARKETING_MANAGE);
  const { guideId } = await context.params;
  return successResponse(await updateGuide(guideId, await parseJsonBody(request, 256 * 1024), user), "Guide saved.");
});

export const DELETE = withDatabase(async (_request, context) => {
  await requireAdminAccess(PERMISSIONS.MARKETING_MANAGE);
  const { guideId } = await context.params;
  const { publicIds } = await deleteGuide(guideId);
  if (publicIds.length) runAfterResponse("Guide image cleanup", () => deleteCloudinaryImages(publicIds));
  return successResponse({ deleted: true }, "Guide deleted.");
});
