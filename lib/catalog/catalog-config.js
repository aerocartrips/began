import { cacheLife, cacheTag } from "next/cache";
import { connectDB } from "@/lib/db/connect";
import { Product } from "@/lib/db/models/Product";
import { ProductType } from "@/lib/db/models/ProductType";
import { ProductAttribute } from "@/lib/db/models/ProductAttribute";
import { listedProductFilter } from "@/lib/constants/product-status";
import { ATTRIBUTE_INPUTS, FILTERABLE_INPUTS, SCHEMA_PROPERTIES } from "@/lib/constants/catalog";
import { catalogCacheTag } from "@/lib/catalog/catalog-cache";
import { runWithTenant } from "@/lib/tenant/context";

/**
 * What a store sells, as the storefront needs it: the product types on sale
 * and the attribute library (names, inputs, values, swatches, filter flags).
 * One cached read per store, invalidated by any catalogue write, shared by
 * the catalogue, product pages, navigation, search engines and checkout.
 *
 * @typedef {import("@/features/catalog/types").CatalogConfig} CatalogConfig
 * @typedef {import("@/features/catalog/types").CatalogTypeConfig} CatalogTypeConfig
 * @typedef {import("@/features/catalog/types").CatalogAttributeConfig} CatalogAttributeConfig
 */

/** @param {Record<string, any> | null | undefined} chart */
function toChart(chart) {
  if (!chart?.rows?.length || !chart.columns?.length) return null;
  return {
    optionKey: chart.optionKey ?? "",
    unit: chart.unit === "cm" ? "cm" : "in",
    columns: chart.columns.map((column) => ({ label: column.label, primary: Boolean(column.primary), measurement: column.measurement !== false })),
    rows: chart.rows.map((row) => ({ size: row.size, values: [...(row.values ?? [])] })),
    note: chart.note ?? "",
    howToMeasure: (chart.howToMeasure ?? []).map((tip) => ({ label: tip.label, text: tip.text ?? "" })),
  };
}

export { toChart as toSizeChart };

/**
 * @param {string} tenantId
 * @returns {Promise<CatalogConfig>}
 */
export async function getCatalogConfig(tenantId) {
  "use cache";
  cacheLife("hours");
  cacheTag(catalogCacheTag(tenantId));

  await connectDB();
  const [types, attributes, counts] = await runWithTenant(tenantId, () =>
    Promise.all([
      ProductType.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean(),
      ProductAttribute.find({}).sort({ sortOrder: 1, name: 1 }).lean(),
      Product.aggregate([{ $match: listedProductFilter() }, { $group: { _id: "$productType", count: { $sum: 1 } } }]),
    ]),
  );
  const byType = new Map(counts.map((row) => [String(row._id), row.count]));

  return {
    types: types.map((type) => ({
      id: String(type._id),
      name: type.name,
      pluralName: type.pluralName,
      slug: type.slug,
      icon: type.icon ?? "package",
      description: type.description ?? "",
      fields: type.fields.map((field) => ({ key: field.key, required: Boolean(field.required) })),
      options: type.options.map((option) => ({ key: option.key, values: [...(option.values ?? [])] })),
      sizeChart: toChart(type.sizeChart),
      template: type.template ?? "",
      coverImage: type.coverImage?.url ? { url: type.coverImage.url, alt: type.coverImage.alt ?? "", ...(type.coverImage.publicId ? { publicId: type.coverImage.publicId } : {}) } : null,
      productCount: byType.get(String(type._id)) ?? 0,
    })),
    attributes: Object.fromEntries(
      attributes.map((attribute) => [
        attribute.key,
        {
          key: attribute.key,
          name: attribute.name,
          input: attribute.input,
          unit: attribute.unit ?? "",
          filterable: Boolean(attribute.filterable) && FILTERABLE_INPUTS.includes(attribute.input),
          visible: attribute.visible !== false,
          schemaProperty: attribute.schemaProperty ?? "",
          values: attribute.values.map((value) => ({ label: value.label, hex: value.hex ?? "" })),
        },
      ]),
    ),
    untypedCount: byType.get("null") ?? 0,
  };
}

/**
 * Whether the store sells sarees only (its default page copy is written for
 * them): every type on sale is a saree type, or, before the catalogue upgrade,
 * it has products without a type (stores were saree-only then).
 * @param {CatalogConfig} config
 */
export function sellsSareesOnly(config) {
  if (!config.types.length) return config.untypedCount > 0;
  return config.types.every((type) => type.template === "saree" || /^sarees?$/i.test(type.pluralName));
}

/**
 * Types on sale that have listed products, for navigation.
 * @param {CatalogConfig} config
 * @returns {CatalogTypeConfig[]}
 */
export const sellingTypes = (config) => config.types.filter((type) => type.productCount > 0);

/**
 * @param {CatalogConfig} config
 * @param {string | null | undefined} id
 */
export const typeById = (config, id) => (id ? config.types.find((type) => type.id === String(id)) ?? null : null);

/**
 * @param {CatalogConfig} config
 * @param {string} slug
 */
export const typeBySlug = (config, slug) => config.types.find((type) => type.slug === slug) ?? null;

/**
 * The colour option of a type (swatches and photos follow it).
 * @param {CatalogTypeConfig | null} type
 * @param {CatalogConfig["attributes"]} attributes
 */
export function colorKeyOf(type, attributes) {
  return type?.options.find((option) => attributes[option.key]?.input === ATTRIBUTE_INPUTS.COLOR)?.key ?? null;
}

/**
 * The option a size chart describes: the chart's own, else the first meaning "size".
 * @param {CatalogTypeConfig | null} type
 * @param {CatalogConfig["attributes"]} attributes
 * @param {{ optionKey: string } | null} [chart]
 */
export function sizeKeyOf(type, attributes, chart = type?.sizeChart ?? null) {
  if (chart?.optionKey) return chart.optionKey;
  return type?.options.find((option) => attributes[option.key]?.schemaProperty === SCHEMA_PROPERTIES.SIZE)?.key ?? null;
}

/** Where an attribute's values live across `types`: on products, on variants, or both. */
function sourceOf(types, key) {
  const detail = types.some((type) => type.fields.some((field) => field.key === key));
  const option = types.some((type) => type.options.some((entry) => entry.key === key));
  return detail && option ? "both" : option ? "option" : "attribute";
}

/**
 * Filter groups a listing offers: the filterable details and options of one
 * type (options first, in its order), or, on a listing that mixes types (the
 * catalogue, categories, search), those at least two of the store's stocked
 * types share, in library order: a filter only one type has would mostly
 * match nothing there, and appears on that type's own listing instead. Each
 * comes with where its values live: on the product, on its variants, or both
 * (an attribute that is a detail of one type and an option of another).
 * @param {CatalogConfig} config
 * @param {CatalogTypeConfig | null} type
 * @returns {{ key: string, source: "attribute" | "option" | "both" }[]}
 */
export function facetKeysFor(config, type) {
  const stocked = config.types.filter((entry) => entry.productCount > 0);
  const types = type ? [type] : stocked.length ? stocked : config.types;
  const usage = new Map();
  for (const entry of types) {
    for (const key of new Set([...entry.fields.map((field) => field.key), ...entry.options.map((option) => option.key)])) {
      usage.set(key, (usage.get(key) ?? 0) + 1);
    }
  }
  const minimum = !type && types.length > 1 ? 2 : 1;
  const order = type
    ? [...type.options.map((entry) => entry.key), ...type.fields.map((field) => field.key)]
    : Object.keys(config.attributes);
  return [...new Set(order)]
    .filter((key) => config.attributes[key]?.filterable && (usage.get(key) ?? 0) >= minimum)
    .map((key) => ({ key, source: sourceOf(types, key) }));
}

/**
 * Filters a listing applies: its offered groups, plus any other filterable
 * attribute the address selects (an older link such as /products?weave=Banarasi
 * keeps filtering even where Weave isn't offered as a group).
 * @param {CatalogConfig} config
 * @param {CatalogTypeConfig | null} type
 * @param {Record<string, string[]>} selected
 */
export function filterKeysFor(config, type, selected) {
  const offered = facetKeysFor(config, type);
  const extra = Object.keys(selected)
    .filter((key) => config.attributes[key]?.filterable && !offered.some((facet) => facet.key === key))
    .map((key) => ({ key, source: sourceOf(type ? [type] : config.types, key) }));
  return [...offered, ...extra];
}

/**
 * Value order for a facet: the type's own list for its options, else the library's.
 * @param {CatalogConfig} config
 * @param {CatalogTypeConfig | null} type
 * @param {string} key
 */
export function valueOrderOf(config, type, key) {
  const own = type?.options.find((option) => option.key === key)?.values;
  if (own?.length) return own;
  return (config.attributes[key]?.values ?? []).map((value) => value.label);
}
