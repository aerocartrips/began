import mongoose from "mongoose";
import { createHash } from "node:crypto";
import { z } from "zod";
import { Product } from "@/lib/db/models/Product";
import { ProductActivity } from "@/lib/db/models/ProductActivity";
import { PRODUCT_STATUS } from "@/lib/constants/product-status";
import { checkRateLimit, recordRateLimitHit } from "@/lib/security/rate-limit";
import { ApiError } from "@/lib/utils/api-error";

/**
 * Shopper interest events (product views, wishlist adds, add-to-carts) feeding
 * store-wide popularity and trending (lib/jobs/product-metrics.job.js).
 *
 * Only daily totals per product are stored. The client fingerprint is a hash
 * used for de-duplication and is kept in rate-limit buckets that expire with
 * their window. Each client counts once per product per window, and a client
 * sending many events is capped, so refreshes and scripts cannot inflate counts.
 */

export const ACTIVITY_TYPES = { VIEW: "view", WISHLIST: "wishlist", CART: "cart" };

const COUNTER = { view: "views", wishlist: "wishlists", cart: "carts" };
const HOUR_MS = 60 * 60 * 1000;
/** One counted event per client, product and type within this window. */
const DEDUP_WINDOW_MS = { view: 6 * HOUR_MS, wishlist: 24 * HOUR_MS, cart: 24 * HOUR_MS };
/** Counted events per client per hour, across all products. */
const CLIENT_HOURLY_CAP = 60;

const activitySchema = z.object({
  productId: z.string().refine((value) => mongoose.isValidObjectId(value), "Invalid product id."),
  type: z.enum(Object.values(ACTIVITY_TYPES)),
});

/** Anonymous per-client key: never stored as-is (rate-limit keys are hashed again). */
export function activityClientKey(ip, userAgent) {
  return createHash("sha256").update(`${ip}|${userAgent}`).digest("base64url").slice(0, 24);
}

const utcDay = (date = new Date()) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

/**
 * @param {unknown} payload `{ productId, type }`
 * @param {string} clientKey from activityClientKey()
 * @returns {Promise<{ counted: boolean }>}
 */
export async function recordProductActivity(payload, clientKey) {
  const parsed = activitySchema.safeParse(payload);
  if (!parsed.success) throw new ApiError(422, "Validation failed.");
  const { productId, type } = parsed.data;

  const capKey = `activity:${clientKey}`;
  const dedupKey = `activity:${type}:${clientKey}:${productId}`;
  const [cap, dedup] = await Promise.all([
    checkRateLimit(capKey, { limit: CLIENT_HOURLY_CAP }),
    checkRateLimit(dedupKey, { limit: 1 }),
  ]);
  if (!cap.allowed || !dedup.allowed) return { counted: false };

  if (!(await Product.exists({ _id: productId, status: PRODUCT_STATUS.ACTIVE }))) return { counted: false };

  await Promise.all([
    recordRateLimitHit(capKey, { windowMs: HOUR_MS }),
    recordRateLimitHit(dedupKey, { windowMs: DEDUP_WINDOW_MS[type] }),
  ]);
  await ProductActivity.updateOne(
    { product: productId, day: utcDay() },
    { $inc: { [COUNTER[type]]: 1 } },
    { upsert: true },
  );
  return { counted: true };
}
