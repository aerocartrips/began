import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { getClientIp } from "@/lib/security/client-ip";
import { consumeRateLimit } from "@/lib/security/rate-limit-guard";
import { ACCOUNT_RATE_LIMITS } from "@/lib/constants/account";
import { requestPasswordReset } from "@/lib/services/password-reset.service";

const SENT = "If an account uses this email, a link to reset the password is on its way. It works for 30 minutes.";

/** Unauthenticated. Answers the same whether or not the email has an account. */
export const POST = withDatabase(async (request) => {
  await consumeRateLimit(`auth:password-reset:${getClientIp(request)}`, ACCOUNT_RATE_LIMITS.passwordResetRequest);
  const payload = await parseJsonBody(request, 2 * 1024);
  const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase().slice(0, 254) : "";
  if (email) await consumeRateLimit(`auth:password-reset:email:${email}`, ACCOUNT_RATE_LIMITS.passwordResetPerEmail, SENT);
  const result = await requestPasswordReset(payload);
  return successResponse(result, SENT);
});
