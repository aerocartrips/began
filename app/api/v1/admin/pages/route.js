import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { getStorePage } from "@/lib/content/pages";
import { STORE_PAGE_SLUGS } from "@/lib/content/store-pages";

export const GET = withDatabase(async (_request, { tenant }) => {
  await requireAdminAccess(PERMISSIONS.SETTINGS_MANAGE);
  const pages = await Promise.all(STORE_PAGE_SLUGS.map((slug) => getStorePage(tenant.id, slug)));
  return successResponse(pages.map(({ slug, title, isDefault, updatedAt }) => ({ slug, title, isDefault, updatedAt })), "Pages fetched.");
});
