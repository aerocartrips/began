import { createHash } from "node:crypto";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
/** @type {Map<string, { count: number, resetAt: number }>} */
const buckets = new Map();

function hashKey(value) {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * @param {string} key
 */
export function checkRateLimit(key) {
  const now = Date.now();
  const bucketKey = hashKey(key);
  const current = buckets.get(bucketKey);

  if (!current || current.resetAt <= now) {
    for (const [storedKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(storedKey);
    }
    buckets.set(bucketKey, { count: 0, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }

  if (current.count >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  return { allowed: true, retryAfter: 0 };
}

/**
 * @param {string} key
 */
export function recordRateLimitHit(key) {
  const bucketKey = hashKey(key);
  const bucket = buckets.get(bucketKey);
  if (bucket && bucket.resetAt > Date.now()) {
    bucket.count += 1;
  }
}

/**
 * @param {Request} request
 */
export function getClientIp(request) {
  const forwarded = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for");
  const candidate = forwarded?.split(",")[0]?.trim() ?? "unknown";
  return /^[\da-fA-F.:]{1,64}$/.test(candidate) ? candidate : "unknown";
}
