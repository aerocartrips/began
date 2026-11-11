import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/auth/session";
import { getClientIp } from "@/lib/security/client-ip";
import { cancelEmailChange, requestEmailVerification } from "@/lib/services/account-security.service";

/**
 * Emails a verification code to a new address (with the current password) or
 * to the current, unverified one; asking again resends. Codes are limited per
 * account in the service (cooldown and hourly cap).
 */
export const POST = withDatabase(async (request) => {
  const user = await requireAuthUser();
  const payload = await parseJsonBody(request, 4 * 1024);
  const result = await requestEmailVerification(user, payload, { ip: getClientIp(request) });
  return successResponse(result, `We sent a code to ${result.email}.`);
});

export const DELETE = withDatabase(async () => {
  const user = await requireAuthUser();
  await cancelEmailChange(user);
  return successResponse(null, "Pending email change cancelled.");
});
