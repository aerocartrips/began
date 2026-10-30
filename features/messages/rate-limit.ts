import { createHash } from "node:crypto";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_MESSAGES_PER_WINDOW = 3;
const buckets = new Map<string, { count: number; resetAt: number }>();

function hashKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function checkContactRateLimit(address: string) {
  const now = Date.now();
  const key = hashKey(address);
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
    buckets.set(key, { count: 0, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  if (current.count >= MAX_MESSAGES_PER_WINDOW) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  return { allowed: true, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
}

export function recordContactMessage(address: string) {
  const key = hashKey(address);
  const bucket = buckets.get(key);
  if (bucket && bucket.resetAt > Date.now()) bucket.count += 1;
}