import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { logoutUser } from "@/lib/services/auth.service";

export const POST = withDatabase(async () => {
  await logoutUser();
  return successResponse(null, "Logged out successfully.");
});
