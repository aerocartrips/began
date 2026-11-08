import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { getClientIp } from "@/lib/security/client-ip";
import { consumeRateLimit } from "@/lib/security/rate-limit-guard";
import { ACCOUNT_RATE_LIMITS } from "@/lib/constants/account";
import { resetPassword } from "@/lib/services/password-reset.service";

/** Unauthenticated: the emailed single-use token is the proof of ownership. */
export const POST = withDatabase(async (request) => {
  const ip = getClientIp(request);
  await consumeRateLimit(`auth:password-reset-confirm:${ip}`, ACCOUNT_RATE_LIMITS.passwordResetConfirm);
  const payload = await parseJsonBody(request, 2 * 1024);
  const result = await resetPassword(payload, ip);
  return successResponse(result, "Your password has been changed. Sign in with your new password.");
});
