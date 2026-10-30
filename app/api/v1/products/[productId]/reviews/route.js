import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { listPublicProductReviews } from "@/lib/services/review.service";
import { ApiError } from "@/lib/utils/api-error";
import mongoose from "mongoose";

export const GET = withDatabase(async (request, context) => {
  const { productId } = await context.params;
  if (!mongoose.isValidObjectId(productId)) {
    throw new ApiError(404, "Product not found.");
  }
  const { searchParams } = new URL(request.url);
  const result = await listPublicProductReviews(productId, searchParams);
  return successResponse(
    { reviews: result.items, summary: result.summary },
    "Product reviews fetched.",
    result.meta,
  );
});
