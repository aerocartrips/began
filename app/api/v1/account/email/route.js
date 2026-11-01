import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/auth/session";
import { getClientIp } from "@/lib/security/client-ip";
import { consumeRateLimit } from "@/lib/security/rate-limit-guard";
import { ACCOUNT_RATE_LIMITS } from "@/lib/constants/account";
import { cancelEmailChange, requestEmailVerification } from "@/lib/services/account-security.service";

export const POST = withDatabase(async (request) => {
  const user = await requireAuthUser();
  await consumeRateLimit(
    `account:email:${user._id}`,
    ACCOUNT_RATE_LIMITS.emailChange,
    "Too many verification emails requested. Please try again later.",
  );
  const payload = await parseJsonBody(request, 4 * 1024);
  const result = await requestEmailVerification(user, payload, {
    ip: getClientIp(request),
    origin: new URL(request.url).origin,
  });
  return successResponse(result, "Verification email sent.");
});

export const DELETE = withDatabase(async () => {
  const user = await requireAuthUser();
  await cancelEmailChange(user);
  return successResponse(null, "Pending email change cancelled.");
});
