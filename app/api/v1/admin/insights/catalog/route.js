import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { getCatalogInsights } from "@/lib/services/catalog-insights.service";

/** Catalogue insights for `?days=` (7–365) and, optionally, one product `?type=`. */
export const GET = withDatabase(async (request) => {
  await requireAdminAccess(PERMISSIONS.CATALOG_MANAGE);
  const params = new URL(request.url).searchParams;
  const insights = await getCatalogInsights({ days: Number(params.get("days") ?? 30), typeId: params.get("type") || null });
  return successResponse(insights, "Catalogue insights fetched.");
});
