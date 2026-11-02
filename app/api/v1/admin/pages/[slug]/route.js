import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { getStorePage, resetStorePage, saveStorePage } from "@/lib/content/pages";
import { ApiError } from "@/lib/utils/api-error";

export const GET = withDatabase(async (_request, context) => {
  await requireAdminAccess(PERMISSIONS.SETTINGS_MANAGE);
  const { slug } = await context.params;
  const page = await getStorePage(context.tenant.id, slug);
  if (!page) throw new ApiError(404, "Unknown page.");
  return successResponse(page, "Page fetched.");
});

export const PUT = withDatabase(async (request, context) => {
  const { user } = await requireAdminAccess(PERMISSIONS.SETTINGS_MANAGE);
  const { slug } = await context.params;
  return successResponse(await saveStorePage(slug, await parseJsonBody(request, 128 * 1024), user), "Page saved.");
});

/** Restore the default template. */
export const DELETE = withDatabase(async (_request, context) => {
  await requireAdminAccess(PERMISSIONS.SETTINGS_MANAGE);
  const { slug } = await context.params;
  return successResponse(await resetStorePage(slug), "Page reset to the default.");
});
