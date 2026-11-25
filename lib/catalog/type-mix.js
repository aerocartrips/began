/**
 * Keeping a store with several product types balanced: rows and the feed take
 * turns between types (so a new type isn't buried under a long-selling one),
 * and categories are grouped under the type their products are.
 * Pure functions; lib/catalog/home.js does the reading.
 */

/** Share of a category's products one type needs for the category to belong to it. */
export const CATEGORY_TYPE_SHARE = 0.8;

/**
 * Takes turns between groups, keeping each group's own order: the first item
 * of every group, then the second of every group, and so on. Groups go in the
 * order given (callers pass the strongest first); empty ones are skipped.
 * @template T
 * @param {T[][]} groups
 * @param {number} [limit]
 * @returns {T[]}
 */
export function interleave(groups, limit = Infinity) {
  const out = [];
  for (let round = 0; out.length < limit; round += 1) {
    let added = false;
    for (const group of groups) {
      if (round >= group.length) continue;
      out.push(group[round]);
      added = true;
      if (out.length >= limit) break;
    }
    if (!added) break;
  }
  return out;
}

/**
 * The product type a category belongs to: the one at least 80% of its
 * products are (a stray product doesn't move a category), else null, for
 * categories that mix types (shown as "Collections").
 * @param {Map<string, number>} counts listed products per type id ("" for none)
 * @returns {string | null}
 */
export function dominantType(counts) {
  let total = 0;
  let best = null;
  let bestCount = 0;
  for (const [type, count] of counts) {
    total += count;
    if (count > bestCount) {
      best = type;
      bestCount = count;
    }
  }
  return best && total > 0 && bestCount / total >= CATEGORY_TYPE_SHARE ? best : null;
}

/**
 * Items grouped under the product types, in the types' order, then a
 * "Collections" group for items without one. Empty groups are left out.
 * @template {{ typeId: string | null }} T
 * @param {T[]} items
 * @param {{ id: string }[]} types
 * @returns {{ typeId: string | null, items: T[] }[]}
 */
export function groupByType(items, types) {
  const known = new Set(types.map((type) => type.id));
  const groups = types.map((type) => ({ typeId: type.id, items: items.filter((item) => item.typeId === type.id) }));
  const rest = items.filter((item) => !item.typeId || !known.has(item.typeId));
  return [...groups, { typeId: null, items: rest }].filter((group) => group.items.length > 0);
}
