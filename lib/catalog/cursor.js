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
