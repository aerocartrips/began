import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { getHomepageAnalytics } from "@/lib/services/analytics.service";

export const GET = withDatabase(async (request) => {
  await requireAdminAccess(PERMISSIONS.MARKETING_MANAGE);
  const days = Number(new URL(request.url).searchParams.get("days") ?? 30);
  return successResponse(await getHomepageAnalytics({ days }), "Home page analytics fetched.");
});
