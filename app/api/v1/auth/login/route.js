import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { loginUser } from "@/lib/services/auth.service";
import { getClientIp } from "@/lib/security/client-ip";
import { checkRateLimit, clearRateLimit, recordRateLimitHit } from "@/lib/security/rate-limit";
import { ApiError } from "@/lib/utils/api-error";

const WINDOW_MS = 15 * 60 * 1000;
/** Failed sign-ins allowed per window: per network address, and per account (stops slow guessing from many addresses). */
const LIMITS = {
  ip: { limit: 20, windowMs: WINDOW_MS },
  account: { limit: 5, windowMs: WINDOW_MS },
};

/**
 * `data.user`: signed in. `data.verification`: the password was right but the
 * email isn't verified yet; a code was emailed and the session opens once it
 * is entered (POST /auth/verify-email).
 */
export const POST = withDatabase(async (request) => {
  const payload = await parseJsonBody(request);
  const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase().slice(0, 254) : "";
  const keys = [
    { key: `login:ip:${getClientIp(request)}`, options: LIMITS.ip },
    ...(email ? [{ key: `login:account:${email}`, options: LIMITS.account }] : []),
  ];

  const blocked = (await Promise.all(keys.map(({ key, options }) => checkRateLimit(key, options)))).find((result) => !result.allowed);
  if (blocked) {
    const error = new ApiError(429, "Too many sign-in attempts. Wait a few minutes, or reset your password.");
    error.retryAfter = blocked.retryAfter;
    throw error;
  }

  try {
    const result = await loginUser(payload);
    // The account's failures are forgotten once its owner signs in; the address limit stays.
    if (email) await clearRateLimit(`login:account:${email}`);
    return successResponse(result, "verification" in result ? "Enter the code we emailed you to finish signing in." : "Login successful.");
  } catch (error) {
    // Only wrong credentials count, so shoppers who sign in often are never locked out.
    if (error instanceof ApiError && error.statusCode === 401) {
      await Promise.all(keys.map(({ key, options }) => recordRateLimitHit(key, options)));
    }
    throw error;
  }
});
