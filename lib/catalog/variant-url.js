import { slugify } from "@/lib/utils/slugify";
import { optionsOf } from "@/lib/catalog/variants";

/**
 * Each variant of a product has its own URL, `/products/[slug]?color=teal&size=m`
 * (one parameter per option, named by the option's attribute key), which
 * opens the page with that variant chosen. Google needs one per variant to
 * show variants in results; the canonical URL stays the plain product URL.
 * A partial address (`?color=teal`) picks the first variant in that colour.
 * Shared by the server (structured data, notifications) and the product page.
 */

/** The colour option's parameter; also the one older colour-only links used. */
export const VARIANT_PARAM = "color";
/** Exact variant by SKU, for variants whose options don't tell them apart. */
export const SKU_PARAM = "sku";

/**
 * @typedef {{ id: string, sku: string, colorName?: string, options?: Record<string, string> | Map<string, string> }} UrlVariant
 */

/**
 * The URL parameters of every variant: its option values (slugified), or its
 * SKU when another variant has the same options (older colour-only data).
 * @param {UrlVariant[]} variants
 * @returns {Map<string, Record<string, string>>} variant id → parameters
 */
export function variantParamValues(variants) {
  const params = new Map();
  const used = new Set();
  for (const variant of variants) {
    const options = optionsOf(variant);
    const keys = Object.keys(options);
    /** @type {Record<string, string>} */
    let values = Object.fromEntries(keys.map((key) => [key, slugify(options[key])]).filter(([, value]) => value));
    if (!keys.length && variant.colorName) values = { [VARIANT_PARAM]: slugify(variant.colorName) };
    const signature = JSON.stringify(values);
    if (!Object.keys(values).length || used.has(signature)) values = { [SKU_PARAM]: slugify(variant.sku) };
    used.add(JSON.stringify(values));
    params.set(variant.id, values);
  }
  return params;
}

/**
 * `?color=teal&size=m` for one variant (no leading "?" when empty).
 * @param {Record<string, string> | undefined} params
 */
export function variantQuery(params) {
  const search = new URLSearchParams(params ?? {}).toString();
  return search ? `?${search}` : "";
}

/**
 * The variant an address selects, or null. Every option parameter given must
 * match; options left out match anything (the first such variant wins).
 * @template {UrlVariant} V
 * @param {V[]} variants
 * @param {URLSearchParams | Record<string, string | string[] | undefined> | string | null | undefined} search
 * @returns {V | null}
 */
export function variantFromParams(variants, search) {
  if (!variants.length || !search) return null;
  const read = toReader(search);
  const params = variantParamValues(variants);

  const sku = read(SKU_PARAM);
  if (sku) {
    const wanted = slugify(sku);
    const match = variants.find((variant) => slugify(variant.sku) === wanted);
    if (match) return match;
  }

  const keys = [...new Set(variants.flatMap((variant) => Object.keys(params.get(variant.id) ?? {})))].filter((key) => key !== SKU_PARAM);
  const given = keys.map((key) => [key, read(key) ? slugify(read(key)) : ""]).filter(([, value]) => value);
  if (given.length) {
    const match = variants.find((variant) => {
      const values = params.get(variant.id) ?? {};
      return given.every(([key, value]) => values[key] === value);
    });
    if (match) return match;
  }

  // Older colour-only links used the SKU as the colour value when two colours shared a name.
  const legacy = read(VARIANT_PARAM);
  if (legacy) return variants.find((variant) => slugify(variant.sku) === slugify(legacy)) ?? null;
  return null;
}

/** @param {URLSearchParams | Record<string, string | string[] | undefined> | string} search */
function toReader(search) {
  if (typeof search === "string") {
    const params = new URLSearchParams(search);
    return (key) => params.get(key) ?? "";
  }
  if (search instanceof URLSearchParams) return (key) => search.get(key) ?? "";
  return (key) => {
    const value = search[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
}
