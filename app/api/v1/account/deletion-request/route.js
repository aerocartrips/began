import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/auth/session";
import { getClientIp } from "@/lib/security/client-ip";
import { consumeRateLimit } from "@/lib/security/rate-limit-guard";
import { ACCOUNT_RATE_LIMITS } from "@/lib/constants/account";
import { toDeletionRequest } from "@/lib/services/account-dto";
import { cancelAccountDeletion, requestAccountDeletion } from "@/lib/services/account-security.service";

export const GET = withDatabase(async () => {
  const user = await requireAuthUser();
  return successResponse(toDeletionRequest(user), "Deletion request fetched.");
});

export const POST = withDatabase(async (request) => {
  const user = await requireAuthUser();
  await consumeRateLimit(`account:deletion:${user._id}`, ACCOUNT_RATE_LIMITS.deletionRequest);
  const payload = await parseJsonBody(request, 4 * 1024);
  const result = await requestAccountDeletion(user, payload, getClientIp(request));
  return successResponse(result, "Account deletion requested.", undefined, 201);
});

export const DELETE = withDatabase(async (request) => {
  const user = await requireAuthUser();
  const result = await cancelAccountDeletion(user, getClientIp(request));
  return successResponse(result, "Account deletion request cancelled.");
});
