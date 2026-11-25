/**
 * Pure helpers for product variants and details, shared by the Product model,
 * the product service, storefront DTOs and the admin form. No database or
 * server-only imports, so they run in the browser too.
 */

/**
 * A variant's options as a plain object, whether they arrive as a Mongoose
 * Map (documents), a plain object (lean reads, JSON) or not at all.
 * @param {{ options?: Map<string, string> | Record<string, string> | null } | null | undefined} variant
 * @returns {Record<string, string>}
 */
export function optionsOf(variant) {
  const options = variant?.options;
  if (!options) return {};
  if (options instanceof Map) return Object.fromEntries(options);
  return { ...options };
}

/**
 * "Red / M": a variant's option values in order, falling back to its colour.
 * @param {Map<string, string> | Record<string, string> | null | undefined} options
 * @param {string} [colorName]
 */
export function variantTitleOf(options, colorName = "") {
  const values = Object.values(optionsOf({ options })).filter(Boolean);
  return values.length ? values.join(" / ") : colorName;
}

/**
 * Words full-text search should find a product by: its detail values, its
 * option values and colours (product names and SKUs are indexed directly).
 * @param {{ attributes?: { value?: string }[], variants?: any[], colors?: string[] }} product
 */
export function searchTextOf(product) {
  const words = new Set();
  for (const entry of product.attributes ?? []) if (entry?.value) words.add(entry.value);
  for (const variant of product.variants ?? []) {
    for (const value of Object.values(optionsOf(variant))) if (value) words.add(value);
  }
  for (const color of product.colors ?? []) if (color) words.add(color);
  return [...words].join(" ").slice(0, 4000);
}

/**
 * Sizes on offer for a product card: "M", "S, L, XL" for up to three, else
 * "S–XXL" (first to last in the type's order).
 * @param {string[]} values distinct sizes the product has
 * @param {string[]} order the type's size order (unlisted values go last, as given)
 */
export function sizeRangeOf(values, order = []) {
  const unique = [...new Set(values.filter(Boolean))];
  if (!unique.length) return "";
  const rank = new Map(order.map((value, index) => [value, index]));
  const sorted = unique
    .map((value, index) => ({ value, index }))
    .sort((left, right) => (rank.get(left.value) ?? order.length + left.index) - (rank.get(right.value) ?? order.length + right.index))
    .map((entry) => entry.value);
  if (sorted.length <= 3) return sorted.join(", ");
  // Sizes that are ranges themselves ("2–3Y") would run together with a dash: "2–3Y to 7–8Y".
  const joiner = /[-–]/.test(sorted[0]) || /[-–]/.test(sorted.at(-1)) ? " to " : "–";
  return `${sorted[0]}${joiner}${sorted.at(-1)}`;
}

/**
 * Every combination of the given option values, in order: the first option
 * varies slowest (Red/S, Red/M, Blue/S, Blue/M), as admins read a size run.
 * @param {{ key: string, values: string[] }[]} options
 * @returns {Record<string, string>[]}
 */
export function optionCombinations(options) {
  const usable = options.filter((option) => option.values.length > 0);
  if (!usable.length) return [];
  return usable.reduce(
    (combos, option) => combos.flatMap((combo) => option.values.map((value) => ({ ...combo, [option.key]: value }))),
    /** @type {Record<string, string>[]} */ ([{}]),
  );
}

/**
 * Stable identity of a combination, independent of key order: "color=Red|size=M".
 * @param {Record<string, string>} options
 */
export function combinationKey(options) {
  return Object.keys(options)
    .sort()
    .map((key) => `${key}=${options[key]}`)
    .join("|");
}

/**
 * A SKU suffix from option values: "Navy Blue", "XL" → "NAVY-XL" (letters and digits, short).
 * @param {string} base product SKU
 * @param {string[]} values
 */
export function variantSkuOf(base, values) {
  const parts = values.map((value) =>
    String(value)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .map((word, index, words) => (words.length > 1 ? word.slice(0, index === 0 ? 4 : 3) : word.slice(0, 6)))
      .join(""),
  );
  return [String(base ?? "").toUpperCase().trim(), ...parts].filter(Boolean).join("-").slice(0, 64);
}
