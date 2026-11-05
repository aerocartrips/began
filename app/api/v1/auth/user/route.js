import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { getCurrentUser } from "@/lib/services/auth.service";
import { requireAuthUser } from "@/lib/auth/session";

/** The signed-in user's full profile. 401 when signed out. */
export const GET = withDatabase(async () => {
  const user = await requireAuthUser();
  return successResponse(await getCurrentUser(user), "Current user fetched successfully.");
});
