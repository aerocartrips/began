import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { deleteCloudinaryImages } from "@/lib/cloudinary/delete";
import { runAfterResponse } from "@/lib/utils/background";
import { deleteBanner, getBanner, updateBanner } from "@/lib/services/banner.service";

export const GET = withDatabase(async (_request, context) => {
  await requireAdminAccess(PERMISSIONS.MARKETING_MANAGE);
  const { bannerId } = await context.params;
  return successResponse(await getBanner(bannerId), "Banner fetched.");
});

export const PATCH = withDatabase(async (request, context) => {
  const { user } = await requireAdminAccess(PERMISSIONS.MARKETING_MANAGE);
  const { bannerId } = await context.params;
  return successResponse(await updateBanner(bannerId, await parseJsonBody(request), user), "Banner updated.");
});

export const DELETE = withDatabase(async (_request, context) => {
  await requireAdminAccess(PERMISSIONS.MARKETING_MANAGE);
  const { bannerId } = await context.params;
  const { publicIds } = await deleteBanner(bannerId);
  // The banner is gone either way; its images are cleaned up after the response.
  if (publicIds.length) runAfterResponse("Banner image cleanup", () => deleteCloudinaryImages(publicIds));
  return successResponse({ deleted: true }, "Banner deleted.");
});
