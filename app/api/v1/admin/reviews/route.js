import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireCommerceAdmin } from "@/lib/middleware/admin-api";
import { listAdminReviews } from "@/lib/services/review.service";

export const GET = withDatabase(async (request) => {
  await requireCommerceAdmin();
  const { searchParams } = new URL(request.url);
  const result = await listAdminReviews(searchParams);
  return successResponse(result.items, "Reviews fetched.", result.meta);
});
