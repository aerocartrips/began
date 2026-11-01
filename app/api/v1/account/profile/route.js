import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/auth/session";
import { getClientIp } from "@/lib/security/client-ip";
import { consumeRateLimit } from "@/lib/security/rate-limit-guard";
import { ACCOUNT_RATE_LIMITS } from "@/lib/constants/account";
import { getProfile, updateProfile } from "@/lib/services/account.service";

export const GET = withDatabase(async () => {
  const user = await requireAuthUser();
  return successResponse(getProfile(user), "Profile fetched.");
});

export const PATCH = withDatabase(async (request) => {
  const user = await requireAuthUser();
  await consumeRateLimit(`account:profile:${user._id}`, ACCOUNT_RATE_LIMITS.profileUpdate);
  const payload = await parseJsonBody(request, 8 * 1024);
  const profile = await updateProfile(user, payload, getClientIp(request));
  return successResponse(profile, "Profile updated.");
});
