/**
 * Explainable, rule-based shopper interest. Pure functions (no database), so
 * the ranking can be tested and reasoned about:
 *
 *   1. buildInterestProfile: what the shopper engaged with (views, wishlist,
 *      cart, purchases), weighted by signal strength and recency, summarised
 *      per dimension: category, product type, each product detail (fabric,
 *      fit, occasion… whatever the store's types describe), colour and price.
 *   2. affinityFor: how well a product matches that profile (0–1).
 *   3. rankRecommendations: affinity blended with store-wide popularity and
 *      freshness, then diversified so one category cannot fill the row.
 */

import { INTEREST_WEIGHTS } from "@/lib/constants/homepage";

/**
 * How much each dimension contributes to affinity. "details" is shared by the
 * detail attributes in proportion to how much of the shopper's history each
 * one explains, so a shopper who only ever looks at silk is matched on fabric
 * while one who browses by fit is matched on fit.
 */
const DIMENSION_WEIGHTS = { category: 0.3, type: 0.1, details: 0.4, color: 0.05 };
const PRICE_WEIGHT = 0.15;
/** Each older signal counts this much of the one before it (most recent first). */
const RECENCY_DECAY = 0.85;
/** Prices further apart than this factor count as no match. */
const PRICE_TOLERANCE = 2.5;
const SCORE_WEIGHTS = { affinity: 0.55, popularity: 0.3, freshness: 0.15 };
const FRESHNESS_HALF_LIFE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const norm = (value) => (typeof value === "string" ? value.trim().toLowerCase() : "");

/**
 * @typedef {{ category?: unknown, productType?: unknown, attributes?: { key: string, value: string }[], colors?: string[], price?: number }} InterestProduct
 * @typedef {{ product: InterestProduct, type: keyof typeof INTEREST_WEIGHTS, rank?: number }} InterestSignal
 *   rank: position in that signal's history, 0 = most recent
 * @typedef {{
 *   category: Record<string, number>, type: Record<string, number>,
 *   details: Record<string, Record<string, number>>, color: Record<string, number>,
 *   price: { logSum: number, weight: number }, total: number,
 * }} InterestProfile
 */

/** @returns {InterestProfile} */
function emptyProfile() {
  return { category: {}, type: {}, details: {}, color: {}, price: { logSum: 0, weight: 0 }, total: 0 };
}

const add = (bucket, key, weight) => {
  if (key) bucket[key] = (bucket[key] ?? 0) + weight;
};

/**
 * A product's detail values by key, normalised (several values split one weight).
 * @param {InterestProduct} product
 * @param {Set<string> | null} keys detail keys that carry interest (the store's filterable ones), or null for all
 */
function detailsOf(product, keys) {
  /** @type {Map<string, string[]>} */
  const byKey = new Map();
  for (const entry of product.attributes ?? []) {
    if (!entry?.key || (keys && !keys.has(entry.key))) continue;
    const value = norm(entry.value);
    if (!value) continue;
    byKey.set(entry.key, [...(byKey.get(entry.key) ?? []), value]);
  }
  return byKey;
}

/**
 * @param {InterestSignal[]} signals
 * @param {{ detailKeys?: Iterable<string> | null }} [options]
 * @returns {InterestProfile}
 */
export function buildInterestProfile(signals, { detailKeys = null } = {}) {
  const keys = detailKeys ? new Set(detailKeys) : null;
  const profile = emptyProfile();
  for (const { product, type, rank = 0 } of signals) {
    const base = INTEREST_WEIGHTS[type];
    if (!base || !product) continue;
    const weight = base * RECENCY_DECAY ** Math.max(0, rank);
    add(profile.category, product.category ? String(product.category) : "", weight);
    add(profile.type, product.productType ? String(product.productType) : "", weight);
    for (const [key, values] of detailsOf(product, keys)) {
      profile.details[key] ??= {};
      for (const value of values) add(profile.details[key], value, weight / values.length);
    }
    for (const color of product.colors ?? []) add(profile.color, norm(color), weight / Math.max(1, product.colors.length));
    if (product.price > 0) {
      profile.price.logSum += Math.log(product.price) * weight;
      profile.price.weight += weight;
    }
    profile.total += weight;
  }
  return profile;
}

const maxOf = (bucket) => Math.max(0, ...Object.values(bucket));
const sumOf = (bucket) => Object.values(bucket).reduce((total, value) => total + value, 0);

/** Best normalised match of `values` in `bucket` (0–1). */
const matchIn = (bucket, values) => {
  const top = maxOf(bucket);
  return top ? Math.max(0, ...values.map((value) => (bucket[value] ?? 0) / top)) : 0;
};

/**
 * How closely a product matches the profile, 0–1. Dimensions the shopper has
 * no history for are left out rather than counted as a mismatch.
 * @param {InterestProduct} product
 * @param {InterestProfile} profile
 */
export function affinityFor(product, profile) {
  if (!profile.total) return 0;
  let score = 0;
  let possible = 0;
  const single = {
    category: [product.category ? String(product.category) : ""],
    type: [product.productType ? String(product.productType) : ""],
    color: (product.colors ?? []).map(norm),
  };
  for (const dimension of /** @type {const} */ (["category", "type", "color"])) {
    if (!maxOf(profile[dimension])) continue;
    possible += DIMENSION_WEIGHTS[dimension];
    score += DIMENSION_WEIGHTS[dimension] * matchIn(profile[dimension], single[dimension]);
  }

  const keyWeights = Object.fromEntries(Object.entries(profile.details).map(([key, bucket]) => [key, sumOf(bucket)]));
  const detailTotal = sumOf(keyWeights);
  if (detailTotal > 0) {
    const values = detailsOf(product, null);
    possible += DIMENSION_WEIGHTS.details;
    for (const [key, weight] of Object.entries(keyWeights)) {
      score += DIMENSION_WEIGHTS.details * (weight / detailTotal) * matchIn(profile.details[key], values.get(key) ?? []);
    }
  }

  if (profile.price.weight > 0 && product.price > 0) {
    possible += PRICE_WEIGHT;
    const preferred = profile.price.logSum / profile.price.weight;
    score += PRICE_WEIGHT * Math.max(0, 1 - Math.abs(Math.log(product.price) - preferred) / Math.log(PRICE_TOLERANCE));
  }
  return possible ? score / possible : 0;
}

/**
 * The thing the shopper is most interested in, for the row's "Based on your
 * interest in …" line: a category or a detail value (category wins ties).
 * The product type is the coarsest signal (in a store selling one type it
 * says nothing), so it explains the row only when nothing narrower does.
 * @param {InterestProfile} profile
 * @returns {{ dimension: "category" | "type" | "detail", key?: string, value: string } | null}
 */
export function strongestInterest(profile) {
  let best = null;
  const consider = (dimension, key, value, weight) => {
    if (!best || weight > best.weight) best = { dimension, key, value, weight };
  };
  for (const [value, weight] of Object.entries(profile.category)) consider("category", undefined, value, weight);
  for (const [key, bucket] of Object.entries(profile.details)) {
    for (const [value, weight] of Object.entries(bucket)) consider("detail", key, value, weight);
  }
  if (!best) for (const [value, weight] of Object.entries(profile.type)) consider("type", undefined, value, weight);
  if (!best) return null;
  return best.dimension === "detail" ? { dimension: "detail", key: best.key, value: best.value } : { dimension: best.dimension, value: best.value };
}

/**
 * The detail values to look for when gathering candidates: the shopper's
 * strongest values across their most telling details.
 * @param {InterestProfile} profile
 * @param {number} [limit]
 * @returns {{ key: string, value: string }[]}
 */
export function topDetailValues(profile, limit = 4) {
  return Object.entries(profile.details)
    .flatMap(([key, bucket]) => Object.entries(bucket).map(([value, weight]) => ({ key, value, weight })))
    .sort((left, right) => right.weight - left.weight)
    .slice(0, limit)
    .map(({ key, value }) => ({ key, value }));
}

/**
 * @template {InterestProduct & { _id: unknown, popularityScore?: number, createdAt?: Date | string, stockQuantity?: number }} T
 * @param {T[]} candidates
 * @param {InterestProfile} profile
 * @param {{ limit: number, exclude?: Set<string>, maxPerCategory?: number, now?: number }} options
 * @returns {T[]}
 */
export function rankRecommendations(candidates, profile, { limit, exclude = new Set(), maxPerCategory = 2, now = Date.now() }) {
  const seen = new Set();
  const unique = candidates.filter((doc) => {
    const id = String(doc._id);
    if (exclude.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const maxPopularity = Math.max(0, ...unique.map((doc) => doc.popularityScore ?? 0));

  const scored = unique
    .map((doc) => {
      const popularity = maxPopularity > 0 ? Math.log1p(doc.popularityScore ?? 0) / Math.log1p(maxPopularity) : 0;
      const ageDays = doc.createdAt ? Math.max(0, (now - new Date(doc.createdAt).getTime()) / DAY_MS) : Infinity;
      const freshness = Number.isFinite(ageDays) ? 0.5 ** (ageDays / FRESHNESS_HALF_LIFE_DAYS) : 0;
      let score =
        SCORE_WEIGHTS.affinity * affinityFor(doc, profile) +
        SCORE_WEIGHTS.popularity * popularity +
        SCORE_WEIGHTS.freshness * freshness;
      if ((doc.stockQuantity ?? 1) <= 0) score *= 0.5;
      return { doc, score };
    })
    .sort((left, right) => right.score - left.score || String(right.doc._id).localeCompare(String(left.doc._id)));

  // Diversity: at most `maxPerCategory` per category on the first pass, then fill.
  const picked = [];
  const skipped = [];
  const perCategory = new Map();
  for (const entry of scored) {
    if (picked.length >= limit) break;
    const category = entry.doc.category ? String(entry.doc.category) : "";
    const count = perCategory.get(category) ?? 0;
    if (category && count >= maxPerCategory) {
      skipped.push(entry);
      continue;
    }
    perCategory.set(category, count + 1);
    picked.push(entry);
  }
  for (const entry of skipped) {
    if (picked.length >= limit) break;
    picked.push(entry);
  }
  return picked.map((entry) => entry.doc);
}
