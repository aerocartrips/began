import { ApiError } from "@/lib/utils/api-error";
import { checkRateLimit, recordRateLimitHit } from "@/lib/security/rate-limit";

/**
 * Counts an attempt against `key` and throws a 429 (with Retry-After) once the
 * window is used up. Every attempt counts, so failed guesses are throttled too.
 * @param {string} key
 * @param {import("@/lib/security/rate-limit").RateLimitOptions} options
 * @param {string} [message]
 */
export async function consumeRateLimit(key, options, message = "Too many requests. Please wait a moment and try again.") {
  const result = await checkRateLimit(key, options);
  if (!result.allowed) {
    const error = new ApiError(429, message);
    error.retryAfter = result.retryAfter;
    throw error;
  }
  await recordRateLimitHit(key, options);
}
