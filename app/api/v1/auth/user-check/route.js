import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { reconcileSession } from "@/lib/auth/session";
import { toSessionUser } from "@/lib/auth/session-user";

/**
 * Lightweight session check. Always 200, so signed-out visitors don't log a
 * 401. It also repairs the cookies: an expired access token is renewed from a
 * valid refresh token, and cookies of a revoked or expired session are cleared.
 */
export const GET = withDatabase(async () => {
  const { user } = await reconcileSession();
  const response = successResponse(
    { authenticated: Boolean(user), user: user ? toSessionUser(user) : null },
    user ? "Signed in." : "Not signed in.",
  );
  response.headers.set("Cache-Control", "private, no-store");
  return response;
});
