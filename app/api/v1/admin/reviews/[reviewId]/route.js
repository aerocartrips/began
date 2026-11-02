import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { deleteAdminReview } from "@/lib/services/review.service";

export const DELETE = withDatabase(async (_request, context) => {
  await requireAdminAccess(PERMISSIONS.REVIEWS_MODERATE);
  const { reviewId } = await context.params;
  await deleteAdminReview(reviewId);
  return successResponse(null, "Review deleted.");
});
