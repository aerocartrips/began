import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/auth/session";
import { getSecurityOverview } from "@/lib/services/account-security.service";

export const GET = withDatabase(async () => {
  const user = await requireAuthUser();
  return successResponse(await getSecurityOverview(user), "Security overview fetched.");
});
