import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireCommerceAdmin } from "@/lib/middleware/admin-api";
import { getAuthUser } from "@/lib/middleware/auth";
import { ROLES } from "@/lib/constants/roles";
import { moderateReview, toPublicReview } from "@/lib/services/review.service";
import { ApiError } from "@/lib/utils/api-error";

export const PATCH = withDatabase(async (request, context) => {
  await requireCommerceAdmin();
  const apiUser = await getAuthUser();
  const adminUser =
    apiUser?.role === ROLES.ADMIN
      ? apiUser
      : { _id: null, email: "admin", name: "Admin" };

  const { reviewId } = await context.params;
  const payload = await parseJsonBody(request);
  const review = await moderateReview(reviewId, adminUser, payload);
  await review.populate("user", "name");
  return successResponse(toPublicReview(review, review.user), "Review moderation updated.");
});
