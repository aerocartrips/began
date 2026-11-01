import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/auth/session";
import { getClientIp } from "@/lib/security/client-ip";
import { checkRateLimit, recordRateLimitHit } from "@/lib/security/rate-limit";
import { extractUploadFiles } from "@/lib/validators/upload.validator";
import { removeReviewImage, toCustomerReview, uploadReviewImages } from "@/lib/services/review.service";
import { ApiError } from "@/lib/utils/api-error";

export const POST = withDatabase(async (request, context) => {
  const user = await requireAuthUser();
  const { reviewId } = await context.params;

  const ip = getClientIp(request);
  const limit = await checkRateLimit(`reviews:upload:${ip}`);
  if (!limit.allowed) {
    throw new ApiError(429, "Too many upload attempts. Please wait before trying again.");
  }

  const formData = await request.formData();
  const extracted = extractUploadFiles(formData);
  if (!extracted.ok) {
    throw new ApiError(422, "Validation failed.", [{ field: "files", message: extracted.message }]);
  }

  const result = await uploadReviewImages(reviewId, user, extracted.files);
  await recordRateLimitHit(`reviews:upload:${ip}`);

  return successResponse(
    {
      review: toCustomerReview(result.review),
      uploaded: result.uploaded,
      failures: result.failures?.length ? result.failures : undefined,
    },
    result.failures?.length ? "Some photos uploaded successfully." : "Review photos uploaded.",
    undefined,
    201,
  );
});

export const DELETE = withDatabase(async (request, context) => {
  const user = await requireAuthUser();
  const { reviewId } = await context.params;
  const { searchParams } = new URL(request.url);
  const imageId = searchParams.get("imageId");
  if (!imageId) {
    throw new ApiError(422, "Validation failed.", [{ field: "imageId", message: "Image id is required." }]);
  }
  const review = await removeReviewImage(reviewId, user, imageId);
  return successResponse(toCustomerReview(review), "Review photo removed.");
});
