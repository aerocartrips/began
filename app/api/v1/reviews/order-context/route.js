import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/middleware/auth";
import { checkRateLimit, getClientIp, recordRateLimitHit } from "@/lib/middleware/rate-limit";
import { formatZodErrors } from "@/lib/validators/auth.validator";
import { orderContextSchema } from "@/lib/validators/review.validator";
import { getOrderReviewContext } from "@/lib/services/review.service";
import { ApiError } from "@/lib/utils/api-error";

export const POST = withDatabase(async (request) => {
  const user = await requireAuthUser();
  const ip = getClientIp(request);
  const limit = checkRateLimit(`reviews:context:${ip}`);
  if (!limit.allowed) {
    throw new ApiError(429, "Too many requests. Please wait before trying again.");
  }

  const payload = await parseJsonBody(request);
  const parsed = orderContextSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  }

  const context = await getOrderReviewContext(user, parsed.data.orderIds);
  recordRateLimitHit(`reviews:context:${ip}`);
  return successResponse(context, "Review context loaded.");
});
