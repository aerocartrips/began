import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { getClientIp } from "@/lib/security/client-ip";
import { consumeRateLimit } from "@/lib/security/rate-limit-guard";
import { ACCOUNT_RATE_LIMITS } from "@/lib/constants/account";
import { confirmEmailVerification } from "@/lib/services/account-security.service";

/** Unauthenticated: the emailed single-use token is the proof of ownership. */
export const POST = withDatabase(async (request) => {
  const ip = getClientIp(request);
  await consumeRateLimit(`account:email-verify:${ip}`, ACCOUNT_RATE_LIMITS.emailVerify);
  const payload = await parseJsonBody(request, 2 * 1024);
  const result = await confirmEmailVerification(payload, ip);
  return successResponse(result, "Email address verified.");
});
