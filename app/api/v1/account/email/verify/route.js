import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/auth/session";
import { getClientIp } from "@/lib/security/client-ip";
import { consumeRateLimit } from "@/lib/security/rate-limit-guard";
import { ACCOUNT_RATE_LIMITS } from "@/lib/constants/account";
import { confirmEmailCode } from "@/lib/services/email-verification.service";

/** Signed in: the code emailed by POST /account/email verifies that address (and switches to it if it is new). */
export const POST = withDatabase(async (request) => {
  const user = await requireAuthUser();
  const ip = getClientIp(request);
  await consumeRateLimit(`account:email-verify:${ip}`, ACCOUNT_RATE_LIMITS.emailVerify, "Too many attempts. Wait a few minutes and try again.");
  const payload = await parseJsonBody(request, 1024);
  const result = await confirmEmailCode(user._id, payload, { ip });
  return successResponse(result, result.changed ? "Your email address has been changed." : "Email address verified.");
});
