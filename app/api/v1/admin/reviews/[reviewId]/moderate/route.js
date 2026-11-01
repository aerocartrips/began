import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { getAuthUser } from "@/lib/auth/session";
import { ROLES } from "@/lib/constants/roles";
import { moderateReview, toPublicReview } from "@/lib/services/review.service";
import { ApiError } from "@/lib/utils/api-error";
// Registers schemas used by populate() below.
import "@/lib/db/models/User";

export const PATCH = withDatabase(async (request, context) => {
  await requireAdminAccess();
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
