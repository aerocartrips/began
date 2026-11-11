import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { registerUser } from "@/lib/services/auth.service";
import { getClientIp } from "@/lib/security/client-ip";
import { checkRateLimit, recordRateLimitHit } from "@/lib/security/rate-limit";
import { ApiError } from "@/lib/utils/api-error";

/**
 * Creates a customer account. `data.user`: signed in. `data.verification`: a
 * code was emailed and the session opens once it is entered (POST /auth/verify-email).
 */
export const POST = withDatabase(async (request) => {
  const ip = getClientIp(request);
  const limit = await checkRateLimit(`register:${ip}`);
  if (!limit.allowed) {
    throw new ApiError(429, "Too many registration attempts. Please try again later.");
  }

  const payload = await parseJsonBody(request);
  const result = await registerUser(payload);
  await recordRateLimitHit(`register:${ip}`);
  const message = "verification" in result ? "Account created. Enter the code we emailed you to finish." : "Registration successful.";
  return successResponse(result, message, undefined, 201);
});
