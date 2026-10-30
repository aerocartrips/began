import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/middleware/auth";
import { listCustomerReviews } from "@/lib/services/review.service";

export const GET = withDatabase(async (request) => {
  const user = await requireAuthUser();
  const { searchParams } = new URL(request.url);
  const result = await listCustomerReviews(user, searchParams);
  return successResponse(result.items, "Reviews fetched.", result.meta);
});
