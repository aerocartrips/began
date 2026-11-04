/**
 * Explainable, rule-based shopper interest. Pure functions (no database), so
 * the ranking can be tested and reasoned about:
 *
 *   1. buildInterestProfile: what the shopper engaged with (views, wishlist,
 *      cart, purchases), weighted by signal strength and recency, summarised
 *      per attribute: category, fabric, weave, occasion, colour and price.
 *   2. affinityFor: how well a product matches that profile (0–1).
 *   3. rankRecommendations: affinity blended with store-wide popularity and
 *      freshness, then diversified so one category cannot fill the row.
 */

import { INTEREST_WEIGHTS } from "@/lib/constants/homepage";

/** How much each attribute contributes to affinity. */
const DIMENSION_WEIGHTS = { category: 0.35, fabric: 0.2, weave: 0.15, occasion: 0.1, color: 0.05 };
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
 * @typedef {{ category?: unknown, fabric?: string, weavingType?: string, occasion?: string, colors?: string[], price?: number }} InterestProduct
 * @typedef {{ product: InterestProduct, type: keyof typeof INTEREST_WEIGHTS, rank?: number }} InterestSignal
 *   rank: position in that signal's history, 0 = most recent
 * @typedef {{
 *   category: Record<string, number>, fabric: Record<string, number>, weave: Record<string, number>,
 *   occasion: Record<string, number>, color: Record<string, number>,
 *   price: { logSum: number, weight: number }, total: number,
 * }} InterestProfile
 */

/** @returns {InterestProfile} */
function emptyProfile() {
  return { category: {}, fabric: {}, weave: {}, occasion: {}, color: {}, price: { logSum: 0, weight: 0 }, total: 0 };
}

const add = (bucket, key, weight) => {
  if (key) bucket[key] = (bucket[key] ?? 0) + weight;
};

/**
 * @param {InterestSignal[]} signals
 * @returns {InterestProfile}
 */
export function buildInterestProfile(signals) {
  const profile = emptyProfile();
  for (const { product, type, rank = 0 } of signals) {
    const base = INTEREST_WEIGHTS[type];
    if (!base || !product) continue;
    const weight = base * RECENCY_DECAY ** Math.max(0, rank);
    add(profile.category, product.category ? String(product.category) : "", weight);
    add(profile.fabric, norm(product.fabric), weight);
    add(profile.weave, norm(product.weavingType), weight);
    add(profile.occasion, norm(product.occasion), weight);
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

/**
 * How closely a product matches the profile, 0–1. Attributes the shopper has
 * no history for are left out rather than counted as a mismatch.
 * @param {InterestProduct} product
 * @param {InterestProfile} profile
 */
export function affinityFor(product, profile) {
  if (!profile.total) return 0;
  let score = 0;
  let possible = 0;
  const values = {
    category: [product.category ? String(product.category) : ""],
    fabric: [norm(product.fabric)],
    weave: [norm(product.weavingType)],
    occasion: [norm(product.occasion)],
    color: (product.colors ?? []).map(norm),
  };
  for (const [dimension, weight] of Object.entries(DIMENSION_WEIGHTS)) {
    const top = maxOf(profile[dimension]);
    if (!top) continue;
    possible += weight;
    score += weight * Math.max(0, ...values[dimension].map((value) => (profile[dimension][value] ?? 0) / top));
  }
  if (profile.price.weight > 0 && product.price > 0) {
    possible += PRICE_WEIGHT;
    const preferred = profile.price.logSum / profile.price.weight;
    score += PRICE_WEIGHT * Math.max(0, 1 - Math.abs(Math.log(product.price) - preferred) / Math.log(PRICE_TOLERANCE));
  }
  return possible ? score / possible : 0;
}

/**
 * The attribute value the shopper is most interested in, for the row's
 * "Based on your interest in …" line. Category wins ties.
 * @param {InterestProfile} profile
 * @returns {{ dimension: "category" | "fabric" | "weave" | "occasion", value: string } | null}
 */
export function strongestInterest(profile) {
  let best = null;
  for (const dimension of ["category", "fabric", "weave", "occasion"]) {
    for (const [value, weight] of Object.entries(profile[dimension])) {
      if (!best || weight > best.weight) best = { dimension, value, weight };
    }
  }
  return best ? { dimension: best.dimension, value: best.value } : null;
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
