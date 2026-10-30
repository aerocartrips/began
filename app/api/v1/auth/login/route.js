import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { loginUser } from "@/lib/services/auth.service";
import { checkRateLimit, getClientIp, recordRateLimitHit } from "@/lib/middleware/rate-limit";
import { ApiError } from "@/lib/utils/api-error";

export const POST = withDatabase(async (request) => {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`login:${ip}`);
  if (!limit.allowed) {
    throw new ApiError(429, "Too many login attempts. Please try again later.");
  }

  const payload = await parseJsonBody(request);
  try {
    const user = await loginUser(payload);
    recordRateLimitHit(`login:${ip}`);
    return successResponse(user, "Login successful.");
  } catch (error) {
    recordRateLimitHit(`login:${ip}`);
    throw error;
  }
});
