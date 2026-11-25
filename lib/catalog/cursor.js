import mongoose from "mongoose";

/**
 * Opaque cursors for the home page product feed, ordered by
 * (popularityScore desc, _id desc). The unique _id tiebreak gives a total
 * order, so a product can never appear on two pages of the same snapshot.
 */

/**
 * @param {{ popularityScore?: number, _id: unknown }} doc last product of a page
 * @returns {string}
 */
export function encodeFeedCursor(doc) {
  return Buffer.from(JSON.stringify({ s: doc.popularityScore ?? 0, i: String(doc._id) })).toString("base64url");
}

/**
 * @param {string | null | undefined} cursor
 * @returns {{ score: number, id: string } | null} null for a missing or malformed cursor (first page)
 */
export function decodeFeedCursor(cursor) {
  if (!cursor || typeof cursor !== "string" || cursor.length > 200) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (!Number.isFinite(parsed?.s) || parsed.s < 0 || !mongoose.isValidObjectId(parsed?.i)) return null;
    return { score: parsed.s, id: String(parsed.i) };
  } catch {
    return null;
  }
}

/** Longest mixed cursor accepted (a position per type; a store has a few dozen types at most). */
export const MAX_MIX_CURSOR_LENGTH = 4000;

/**
 * Cursor for the feed that takes turns between product types: where each
 * type's own popularity order got to. A type mapped to 0 has run out; a type
 * missing from it (added since) starts from its beginning.
 * @param {Record<string, { score: number, id: string } | 0>} positions by type id ("none" for products without one)
 * @returns {string}
 */
export function encodeMixCursor(positions) {
  const compact = Object.fromEntries(Object.entries(positions).map(([type, position]) => [type, position ? [position.score, position.id] : 0]));
  return Buffer.from(JSON.stringify({ m: compact })).toString("base64url");
}

/**
 * @param {string | null | undefined} cursor
 * @returns {Record<string, { score: number, id: string } | 0> | null} null for a missing or malformed cursor (first page)
 */
export function decodeMixCursor(cursor) {
  if (!cursor || typeof cursor !== "string" || cursor.length > MAX_MIX_CURSOR_LENGTH) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (!parsed || typeof parsed.m !== "object" || Array.isArray(parsed.m)) return null;
    /** @type {Record<string, { score: number, id: string } | 0>} */
    const positions = {};
    for (const [type, value] of Object.entries(parsed.m)) {
      if (type !== "none" && !mongoose.isValidObjectId(type)) return null;
      if (value === 0) {
        positions[type] = 0;
        continue;
      }
      if (!Array.isArray(value) || !Number.isFinite(value[0]) || value[0] < 0 || !mongoose.isValidObjectId(value[1])) return null;
      positions[type] = { score: value[0], id: String(value[1]) };
    }
    return positions;
  } catch {
    return null;
  }
}

/**
 * MongoDB filter for everything after the cursor in feed order.
 * @param {{ score: number, id: string } | null} position
 */
export function feedCursorFilter(position) {
  if (!position) return {};
  const id = new mongoose.Types.ObjectId(position.id);
  return {
    $or: [{ popularityScore: { $lt: position.score } }, { popularityScore: position.score, _id: { $lt: id } }],
  };
}
