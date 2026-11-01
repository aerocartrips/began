import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/auth/session";
import { getClientIp } from "@/lib/security/client-ip";
import { revokeAllSessions } from "@/lib/services/account-security.service";

export const POST = withDatabase(async (request) => {
  const user = await requireAuthUser();
  await revokeAllSessions(user, getClientIp(request));
  return successResponse(null, "Signed out of all devices.");
});
