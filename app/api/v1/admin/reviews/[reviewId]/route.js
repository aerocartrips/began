import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireCommerceAdmin } from "@/lib/middleware/admin-api";
import { deleteAdminReview } from "@/lib/services/review.service";

export const DELETE = withDatabase(async (_request, context) => {
  await requireCommerceAdmin();
  const { reviewId } = await context.params;
  await deleteAdminReview(reviewId);
  return successResponse(null, "Review deleted.");
});
