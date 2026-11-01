import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/auth/session";
import {
  deleteCustomerReview,
  toCustomerReview,
  updateCustomerReview,
} from "@/lib/services/review.service";

export const PATCH = withDatabase(async (request, context) => {
  const user = await requireAuthUser();
  const { reviewId } = await context.params;
  const payload = await parseJsonBody(request);
  const review = await updateCustomerReview(reviewId, user, payload);
  return successResponse(
    toCustomerReview(review),
    "Your review was updated and is awaiting approval.",
  );
});

export const DELETE = withDatabase(async (_request, context) => {
  const user = await requireAuthUser();
  const { reviewId } = await context.params;
  await deleteCustomerReview(reviewId, user);
  return successResponse(null, "Review removed.");
});
