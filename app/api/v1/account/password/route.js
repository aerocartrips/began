import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/auth/session";
import { getClientIp } from "@/lib/security/client-ip";
import { consumeRateLimit } from "@/lib/security/rate-limit-guard";
import { ACCOUNT_RATE_LIMITS } from "@/lib/constants/account";
import { changePassword } from "@/lib/services/account-security.service";

export const POST = withDatabase(async (request) => {
  const user = await requireAuthUser();
  await consumeRateLimit(
    `account:password:${user._id}`,
    ACCOUNT_RATE_LIMITS.passwordChange,
    "Too many password change attempts. Please try again later.",
  );
  const payload = await parseJsonBody(request, 2 * 1024);
  const result = await changePassword(user, payload, getClientIp(request));
  return successResponse(result, "Password changed. Other devices have been signed out.");
});
