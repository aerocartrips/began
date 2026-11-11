import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { getClientIp } from "@/lib/security/client-ip";
import { consumeRateLimit } from "@/lib/security/rate-limit-guard";
import { ACCOUNT_RATE_LIMITS } from "@/lib/constants/account";
import { completeEmailVerification } from "@/lib/services/auth.service";

/**
 * Second step of signing up or signing in with an unverified email: the
 * sign-in cookie set by /auth/register or /auth/login, plus the emailed code,
 * open the session.
 */
export const POST = withDatabase(async (request) => {
  const ip = getClientIp(request);
  await consumeRateLimit(`auth:email-code:${ip}`, ACCOUNT_RATE_LIMITS.emailVerify, "Too many attempts. Wait a few minutes and try again.");
  const payload = await parseJsonBody(request, 1024);
  const result = await completeEmailVerification(payload, ip);
  return successResponse(result, "Email verified. You're signed in.");
});
