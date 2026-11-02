import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { listAdminReviews } from "@/lib/services/review.service";

export const GET = withDatabase(async (request) => {
  await requireAdminAccess(PERMISSIONS.REVIEWS_MODERATE);
  const { searchParams } = new URL(request.url);
  const result = await listAdminReviews(searchParams);
  return successResponse(result.items, "Reviews fetched.", result.meta);
});
