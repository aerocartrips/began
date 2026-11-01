import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { refreshSessionFromCookie } from "@/lib/auth/session";

export const POST = withDatabase(async () => {
  const user = await refreshSessionFromCookie();
  return successResponse(user, "Session refreshed successfully.");
});
