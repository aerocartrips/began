import "server-only";

import { createHash } from "node:crypto";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const MAX_BUCKETS = 2000;

type AttemptBucket = {
  failures: number;
  resetAt: number;
};

const attempts = new Map<string, AttemptBucket>();

function keyFor(identifier: string) {
  return createHash("sha256").update(identifier).digest("hex");
}

function pruneExpired(now: number) {
  for (const [key, bucket] of attempts) {
    if (bucket.resetAt <= now) attempts.delete(key);
  }
  while (attempts.size >= MAX_BUCKETS) {
    const oldestKey = attempts.keys().next().value;
    if (!oldestKey) break;
    attempts.delete(oldestKey);
  }
}

export function getLoginRateLimit(identifier: string) {
  const bucket = attempts.get(keyFor(identifier));
  if (!bucket || bucket.resetAt <= Date.now()) return { allowed: true, retryAfter: 0 };
  return {
    allowed: bucket.failures < MAX_FAILURES,
    retryAfter: Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000)),
  };
}

export function recordLoginFailure(identifier: string) {
  const now = Date.now();
  pruneExpired(now);
  const key = keyFor(identifier);
  const bucket = attempts.get(key);
  if (!bucket || bucket.resetAt <= now) {
    attempts.set(key, { failures: 1, resetAt: now + WINDOW_MS });
    return;
  }
  bucket.failures += 1;
}

export function clearLoginFailures(identifier: string) {
  attempts.delete(keyFor(identifier));
}