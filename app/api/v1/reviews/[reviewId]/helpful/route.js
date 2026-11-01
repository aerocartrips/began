import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/auth/session";
import { markReviewHelpful, removeReviewHelpfulVote } from "@/lib/services/review-helpful.service";

export const POST = withDatabase(async (_request, context) => {
  const user = await requireAuthUser();
  const { reviewId } = await context.params;
  const result = await markReviewHelpful(reviewId, user);
  return successResponse(result, "Vote recorded.");
});

export const DELETE = withDatabase(async (_request, context) => {
  const user = await requireAuthUser();
  const { reviewId } = await context.params;
  const result = await removeReviewHelpfulVote(reviewId, user);
  return successResponse(result, "Vote removed.");
});
