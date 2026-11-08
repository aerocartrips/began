import { Order } from "@/lib/db/models/Order";
import { Product } from "@/lib/db/models/Product";
import { ProductActivity } from "@/lib/db/models/ProductActivity";
import { runLockedJob } from "@/lib/jobs/run-locked-job";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants/order-status";
import {
  BESTSELLER_WINDOW_DAYS,
  POPULARITY_HALF_LIFE_DAYS,
  POPULARITY_WEIGHTS,
  POPULARITY_WINDOW_DAYS,
  TRENDING_MIN_POINTS,
  TRENDING_WINDOW_DAYS,
} from "@/lib/constants/homepage";
import { invalidateCatalogCache } from "@/lib/catalog/catalog-cache";
import { requireTenantId } from "@/lib/tenant/context";

/**
 * Recomputes each product's demand metrics for the current store:
 *
 * - salesCount: paid, non-cancelled orders containing the product in the last
 *   BESTSELLER_WINDOW_DAYS days. Drives "Best sellers".
 * - popularityScore: views, wishlist adds, add-to-carts and orders over the
 *   last POPULARITY_WINDOW_DAYS days, each weighted (POPULARITY_WEIGHTS) and
 *   halved every POPULARITY_HALF_LIFE_DAYS days. Drives "Popular" sorting,
 *   the feed order and recommendations.
 * - trendingScore: activity in the last TRENDING_WINDOW_DAYS days, boosted
 *   when it is above the product's own earlier weekly average. Zero unless the
 *   recent activity reaches TRENDING_MIN_POINTS, so quiet products are never
 *   labelled trending.
 *
 * Run it on a schedule (hourly is plenty): GET /api/cron/product-metrics.
 */

const JOB_NAME = "product_metrics";
const DAY_MS = 24 * 60 * 60 * 1000;
const WRITE_BATCH = 500;
/** Earlier activity used as the trending baseline (the weeks before the trending window). */
const BASELINE_DAYS = 21;
const MAX_TRENDING_BOOST = 3;
const COUNTING_PAYMENTS = [PAYMENT_STATUS.PAID, PAYMENT_STATUS.PARTIALLY_REFUNDED];
const NOT_COUNTING_ORDERS = [ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURNED];

const round = (value) => Math.round(value * 100) / 100;

/** Aggregation expression: 0.5 ^ (age in days / half-life). */
const decayExpression = (dateField, now) => ({
  $pow: [0.5, { $divide: [{ $divide: [{ $subtract: [now, dateField] }, DAY_MS] }, POPULARITY_HALF_LIFE_DAYS] }],
});

/**
 * Pure scoring step, exported for tests.
 * @param {{ decayed: number, recent: number, baseline: number }} points weighted activity
 */
export function scoreProduct({ decayed, recent, baseline }) {
  const weeklyBaseline = baseline / (BASELINE_DAYS / TRENDING_WINDOW_DAYS);
  const momentum = Math.min(MAX_TRENDING_BOOST, (recent + 1) / (weeklyBaseline + 1));
  return {
    popularityScore: round(decayed),
    trendingScore: recent >= TRENDING_MIN_POINTS ? round(recent * momentum) : 0,
  };
}

async function activityPoints(now) {
  const since = new Date(now.getTime() - POPULARITY_WINDOW_DAYS * DAY_MS);
  const recentSince = new Date(now.getTime() - TRENDING_WINDOW_DAYS * DAY_MS);
  const baselineSince = new Date(recentSince.getTime() - BASELINE_DAYS * DAY_MS);
  const points = {
    $add: [
      { $multiply: ["$views", POPULARITY_WEIGHTS.view] },
      { $multiply: ["$wishlists", POPULARITY_WEIGHTS.wishlist] },
      { $multiply: ["$carts", POPULARITY_WEIGHTS.cart] },
    ],
  };
  return ProductActivity.aggregate([
    { $match: { day: { $gte: since } } },
    {
      $group: {
        _id: "$product",
        decayed: { $sum: { $multiply: [points, decayExpression("$day", now)] } },
        recent: { $sum: { $cond: [{ $gte: ["$day", recentSince] }, points, 0] } },
        baseline: { $sum: { $cond: [{ $and: [{ $gte: ["$day", baselineSince] }, { $lt: ["$day", recentSince] }] }, points, 0] } },
      },
    },
  ]);
}

async function orderPoints(now) {
  const since = new Date(now.getTime() - Math.max(BESTSELLER_WINDOW_DAYS, POPULARITY_WINDOW_DAYS) * DAY_MS);
  const popularitySince = new Date(now.getTime() - POPULARITY_WINDOW_DAYS * DAY_MS);
  const recentSince = new Date(now.getTime() - TRENDING_WINDOW_DAYS * DAY_MS);
  const baselineSince = new Date(recentSince.getTime() - BASELINE_DAYS * DAY_MS);
  const bestsellerSince = new Date(now.getTime() - BESTSELLER_WINDOW_DAYS * DAY_MS);
  const weight = POPULARITY_WEIGHTS.order;
  return Order.aggregate([
    { $match: { paymentStatus: { $in: COUNTING_PAYMENTS }, createdAt: { $gte: since }, orderStatus: { $nin: NOT_COUNTING_ORDERS } } },
    { $project: { createdAt: 1, products: { $setUnion: ["$items.product", []] } } },
    { $unwind: "$products" },
    {
      $group: {
        _id: "$products",
        salesCount: { $sum: { $cond: [{ $gte: ["$createdAt", bestsellerSince] }, 1, 0] } },
        decayed: { $sum: { $cond: [{ $gte: ["$createdAt", popularitySince] }, { $multiply: [weight, decayExpression("$createdAt", now)] }, 0] } },
        recent: { $sum: { $cond: [{ $gte: ["$createdAt", recentSince] }, weight, 0] } },
        baseline: {
          $sum: { $cond: [{ $and: [{ $gte: ["$createdAt", baselineSince] }, { $lt: ["$createdAt", recentSince] }] }, weight, 0] },
        },
      },
    },
  ]);
}

/**
 * Computes and saves metrics for every product with recent demand, and
 * resets products whose demand has lapsed.
 * @param {{ now?: Date }} [options]
 * @returns {Promise<number>} products updated
 */
export async function recomputeProductMetrics({ now = new Date() } = {}) {
  const tenantId = requireTenantId();
  const [activity, orders] = await Promise.all([activityPoints(now), orderPoints(now)]);

  /** @type {Map<string, { decayed: number, recent: number, baseline: number, salesCount: number }>} */
  const totals = new Map();
  for (const row of [...activity, ...orders]) {
    const id = String(row._id);
    const total = totals.get(id) ?? { decayed: 0, recent: 0, baseline: 0, salesCount: 0 };
    total.decayed += row.decayed ?? 0;
    total.recent += row.recent ?? 0;
    total.baseline += row.baseline ?? 0;
    total.salesCount += row.salesCount ?? 0;
    totals.set(id, total);
  }

  const updates = [...totals].map(([id, total]) => ({
    updateOne: {
      // bulkWrite skips the tenant-scope middleware, so the tenant is set explicitly.
      filter: { _id: id, tenantId },
      update: { $set: { ...scoreProduct(total), salesCount: total.salesCount, metricsUpdatedAt: now } },
    },
  }));
  for (let index = 0; index < updates.length; index += WRITE_BATCH) {
    await Product.bulkWrite(updates.slice(index, index + WRITE_BATCH), { ordered: false });
  }
  // Everything this run did not touch has no recent demand. Matching on the run's
  // timestamp (not a list of ids) keeps this one small query on any catalogue size.
  await Product.updateMany(
    {
      metricsUpdatedAt: { $ne: now },
      $or: [{ popularityScore: { $gt: 0 } }, { trendingScore: { $gt: 0 } }, { salesCount: { $gt: 0 } }],
    },
    { $set: { popularityScore: 0, trendingScore: 0, salesCount: 0, metricsUpdatedAt: now } },
  );
  invalidateCatalogCache(tenantId);
  return updates.length;
}

/**
 * Runs the recompute for the current store, at most once at a time (see
 * runLockedJob): overlapping cron calls or an admin clicking "Run now" during a
 * scheduled run are skipped instead of doing the work twice. Results are
 * recomputed from source data each time, so running it again, or more often,
 * is always safe.
 * @returns {Promise<import("mongoose").Document & Record<string, any> | { status: "skipped", reason: string }>}
 */
export async function runProductMetricsJob({ triggeredBy = "scheduler" } = {}) {
  const startedAt = new Date();
  return runLockedJob(JOB_NAME, { triggeredBy }, () => recomputeProductMetrics({ now: startedAt }));
}

export { JOB_NAME as PRODUCT_METRICS_JOB_NAME };
