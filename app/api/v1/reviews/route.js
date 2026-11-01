import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/auth/session";
import { createOrUpdateCustomerReview, toCustomerReview } from "@/lib/services/review.service";

export const POST = withDatabase(async (request) => {
  const user = await requireAuthUser();
  const payload = await parseJsonBody(request);
  const review = await createOrUpdateCustomerReview(user, payload);
  return successResponse(
    toCustomerReview(review),
    "Thank you for sharing your experience! Your review has been submitted and is awaiting approval.",
    undefined,
    201,
  );
});
