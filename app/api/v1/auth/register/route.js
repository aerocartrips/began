import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { registerUser } from "@/lib/services/auth.service";
import { checkRateLimit, getClientIp, recordRateLimitHit } from "@/lib/middleware/rate-limit";
import { ApiError } from "@/lib/utils/api-error";

export const POST = withDatabase(async (request) => {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`register:${ip}`);
  if (!limit.allowed) {
    throw new ApiError(429, "Too many registration attempts. Please try again later.");
  }

  const payload = await parseJsonBody(request);
  const user = await registerUser(payload);
  recordRateLimitHit(`register:${ip}`);
  return successResponse(user, "Registration successful.", undefined, 201);
});
