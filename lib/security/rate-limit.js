import { createHash } from "node:crypto";
import { connectDB, isDatabaseConfigured } from "@/lib/db/connect";
import { RateLimit } from "@/lib/db/models/RateLimit";
import { ApiError } from "@/lib/utils/api-error";
import { logger } from "@/lib/utils/logger";

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_LIMIT = 10;
const MAX_MEMORY_BUCKETS = 5000;

/**
 * @typedef {{ limit?: number; windowMs?: number }} RateLimitOptions
 * @typedef {{ allowed: boolean; retryAfter: number }} RateLimitResult
 */

/** @type {Map<string, { count: number, resetAt: number }>} */
const memoryBuckets = new Map();

function hashKey(value) {
  return createHash("sha256").update(value).digest("hex");
}

function retryAfterSeconds(resetAt, now) {
  return Math.max(1, Math.ceil((resetAt - now) / 1000));
}

function pruneMemory(now) {
  for (const [key, bucket] of memoryBuckets) {
    if (bucket.resetAt <= now) memoryBuckets.delete(key);
  }
  while (memoryBuckets.size >= MAX_MEMORY_BUCKETS) {
    const oldestKey = memoryBuckets.keys().next().value;
    if (!oldestKey) break;
    memoryBuckets.delete(oldestKey);
  }
}

const memoryStore = {
  async get(key, now) {
    const bucket = memoryBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) return null;
    return bucket;
  },
  async increment(key, now, windowMs) {
    const bucket = memoryBuckets.get(key);
    if (bucket && bucket.resetAt > now) {
      bucket.count += 1;
      return;
    }
    pruneMemory(now);
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
  },
  async clear(key) {
    memoryBuckets.delete(key);
  },
};

const databaseStore = {
  async get(key, now) {
    await connectDB();
    const bucket = await RateLimit.findOne({ key, resetAt: { $gt: new Date(now) } }).lean();
    if (!bucket) return null;
    return { count: bucket.count, resetAt: bucket.resetAt.getTime() };
  },
  async increment(key, now, windowMs) {
    await connectDB();
    const updated = await RateLimit.updateOne(
      { key, resetAt: { $gt: new Date(now) } },
      { $inc: { count: 1 } },
    );
    if (updated.matchedCount > 0) return;
    // No live window: start a new one (replaces an expired bucket not yet removed by TTL).
    await RateLimit.updateOne(
      { key },
      { $set: { count: 1, resetAt: new Date(now + windowMs) } },
      { upsert: true },
    );
  },
  async clear(key) {
    await connectDB();
    await RateLimit.deleteOne({ key });
  },
};

/**
 * Runs against MongoDB when configured so limits are shared across server
 * instances; falls back to process memory if the database is unavailable.
 * @template T
 * @param {(store: typeof memoryStore) => Promise<T>} operation
 */
async function withStore(operation) {
  if (isDatabaseConfigured()) {
    try {
      return await operation(databaseStore);
    } catch (error) {
      logger.warn("Rate limit store unavailable; using in-memory fallback", { error });
    }
  }
  return operation(memoryStore);
}

/**
 * @param {string} key
 * @param {RateLimitOptions} [options]
 * @returns {Promise<RateLimitResult>}
 */
export async function checkRateLimit(key, options = {}) {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const now = Date.now();
  const bucket = await withStore((store) => store.get(hashKey(key), now));
  if (bucket && bucket.count >= limit) {
    return { allowed: false, retryAfter: retryAfterSeconds(bucket.resetAt, now) };
  }
  return { allowed: true, retryAfter: 0 };
}

/**
 * @param {string} key
 * @param {RateLimitOptions} [options]
 */
export async function recordRateLimitHit(key, options = {}) {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  await withStore((store) => store.increment(hashKey(key), Date.now(), windowMs));
}

/**
 * @param {string} key
 */
export async function clearRateLimit(key) {
  await withStore((store) => store.clear(hashKey(key)));
}

/**
 * Throws a 429 when `key` has used up its window.
 * @param {string} key
 * @param {RateLimitOptions} options
 * @param {string} [message]
 */
export async function assertRateLimit(key, options, message = "Too many requests. Please wait a moment and try again.") {
  const result = await checkRateLimit(key, options);
  if (!result.allowed) {
    const error = new ApiError(429, message);
    error.retryAfter = result.retryAfter;
    throw error;
  }
}
