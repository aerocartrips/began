import { slugify } from "@/lib/utils/slugify";

/**
 * Each colour of a product has its own URL, `/products/[slug]?color=teal`,
 * which opens the page with that colour chosen (photos, SKU, stock). Google
 * needs one per variant to show variants in results; the canonical URL stays
 * the plain product URL. Shared by the server (structured data) and the
 * product page (preselection).
 */
export const VARIANT_PARAM = "color";

/**
 * The `?color=` value of every variant: its colour name, or its SKU when two
 * variants share a colour name.
 * @param {{ id: string, colorName: string, sku: string }[]} variants
 * @returns {Map<string, string>} variant id → value
 */
export function variantParamValues(variants) {
  const values = new Map();
  const used = new Set();
  for (const variant of variants) {
    const byColour = slugify(variant.colorName);
    const value = byColour && !used.has(byColour) ? byColour : slugify(variant.sku);
    used.add(value);
    values.set(variant.id, value);
  }
  return values;
}

/**
 * The variant a `?color=` value selects, or null.
 * @template {{ id: string, colorName: string, sku: string }} V
 * @param {V[]} variants
 * @param {string | null | undefined} value
 * @returns {V | null}
 */
export function variantFromParam(variants, value) {
  if (!value) return null;
  const wanted = value.trim().toLowerCase();
  const values = variantParamValues(variants);
  return variants.find((variant) => values.get(variant.id) === wanted) ?? null;
}
