import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/auth/session";
import { consumeRateLimit } from "@/lib/security/rate-limit-guard";
import { ACCOUNT_RATE_LIMITS } from "@/lib/constants/account";
import { getPreferences, updatePreferences } from "@/lib/services/account.service";

export const GET = withDatabase(async () => {
  const user = await requireAuthUser();
  return successResponse(getPreferences(user), "Preferences fetched.");
});

export const PATCH = withDatabase(async (request) => {
  const user = await requireAuthUser();
  await consumeRateLimit(`account:preferences:${user._id}`, ACCOUNT_RATE_LIMITS.profileUpdate);
  const payload = await parseJsonBody(request, 2 * 1024);
  return successResponse(await updatePreferences(user, payload), "Preferences saved.");
});
