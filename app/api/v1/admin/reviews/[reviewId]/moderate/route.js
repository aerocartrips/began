import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminUser } from "@/lib/auth/admin-access";
import { moderateReview, toPublicReview } from "@/lib/services/review.service";
// Registers schemas used by populate() below.
import "@/lib/db/models/User";

export const PATCH = withDatabase(async (request, context) => {
  const adminUser = await requireAdminUser(PERMISSIONS.REVIEWS_MODERATE);
  const { reviewId } = await context.params;
  const payload = await parseJsonBody(request);
  const review = await moderateReview(reviewId, adminUser, payload);
  await review.populate("user", "name");
  return successResponse(toPublicReview(review, review.user), "Review moderation updated.");
});
