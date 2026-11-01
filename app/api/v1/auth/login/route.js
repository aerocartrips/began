import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { loginUser } from "@/lib/services/auth.service";
import { getClientIp } from "@/lib/security/client-ip";
import { checkRateLimit, recordRateLimitHit } from "@/lib/security/rate-limit";
import { ApiError } from "@/lib/utils/api-error";

export const POST = withDatabase(async (request) => {
  const ip = getClientIp(request);
  const limit = await checkRateLimit(`login:${ip}`);
  if (!limit.allowed) {
    throw new ApiError(429, "Too many login attempts. Please try again later.");
  }

  const payload = await parseJsonBody(request);
  try {
    const user = await loginUser(payload);
    await recordRateLimitHit(`login:${ip}`);
    return successResponse(user, "Login successful.");
  } catch (error) {
    await recordRateLimitHit(`login:${ip}`);
    throw error;
  }
});
