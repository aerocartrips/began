import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { getCurrentUser } from "@/lib/services/auth.service";
import { requireAuthUser } from "@/lib/middleware/auth";

export const GET = withDatabase(async () => {
  const user = await requireAuthUser();
  return successResponse(await getCurrentUser(user), "Current user fetched successfully.");
});
