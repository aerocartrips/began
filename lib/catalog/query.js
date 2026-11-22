import mongoose from "mongoose";
import { z } from "zod";
import { cacheLife, cacheTag } from "next/cache";
import { connectDB } from "@/lib/db/connect";
import { Product } from "@/lib/db/models/Product";
import { Category } from "@/lib/db/models/Category";
import { ProductType } from "@/lib/db/models/ProductType";
import { listedProductFilter } from "@/lib/constants/product-status";
import {
  CATALOG_FACET_LIMIT,
  CATALOG_MAX_FILTER_KEYS,
  CATALOG_MAX_FILTER_VALUES,
  CATALOG_MAX_PAGE,
  CATALOG_PAGE_SIZE,
  CATALOG_SORTS,
  SCHEMA_PROPERTIES,
} from "@/lib/constants/catalog";
import { catalogCacheTag } from "@/lib/catalog/catalog-cache";
import { facetKeysFor, filterKeysFor, getCatalogConfig, typeBySlug, valueOrderOf } from "@/lib/catalog/catalog-config";
import { CARD_FIELDS, DETAIL_FIELDS, toCatalogImage, toProductCard, toProductDetail } from "@/lib/catalog/dto";
import { basePriceFor, priceFieldFor } from "@/lib/catalog/pricing";
import { runWithTenant } from "@/lib/tenant/context";
import { escapeRegex } from "@/lib/utils/escape-regex";

/**
 * Storefront catalog reads. Every function takes the tenant id and sales mode
 * explicitly: they are part of each cache key, so one store's cached results
 * can never be served to another. Entries are invalidated by product,
 * category, type and attribute writes (catalogCacheTag).
 *
 * Filters follow the store's attribute library: any attribute marked
 * filterable is a URL parameter (`?fabric=Silk&size=M`). Values of product
 * details live in `attributes` ({ key, value } pairs, one index for all);
 * values of options (colour, size) live on the variants, and every option
 * selected must be met by one variant together (Red and M means a red M,
 * in stock when "In stock only" is on), as shoppers expect.
 *
 * @typedef {import("@/features/catalog/types").CatalogQuery} CatalogQuery
 * @typedef {import("@/features/catalog/types").CatalogConfig} CatalogConfig
 * @typedef {"wholesale" | "retail"} SalesMode
 */

const priceParam = z
  .string()
  .optional()
  .transform((value) => {
    const number = Number(value);
    return value && Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
  });

const querySchema = z.object({
  q: z.string().optional().transform((value) => value?.trim().slice(0, 100) ?? ""),
  category: z.string().optional().transform((value) => value?.trim().toLowerCase().slice(0, 90) ?? ""),
  type: z.string().optional().transform((value) => value?.trim().toLowerCase().slice(0, 90) ?? ""),
  min: priceParam,
  max: priceParam,
  stock: z.string().optional(),
  sort: z.string().optional(),
  page: z.string().optional(),
});

const first = (value) => (Array.isArray(value) ? value[0] : value);

/**
 * Selected values of one filter: trimmed, de-duplicated, capped, and spelled
 * as the attribute's list spells them (`?fabric=pure silk` → "Pure Silk").
 * @param {string | string[] | undefined} raw
 * @param {{ values: { label: string }[] } | undefined} attribute
 */
function filterValues(raw, attribute) {
  const list = (Array.isArray(raw) ? raw : raw ? [raw] : []).map((entry) => String(entry).trim().slice(0, 80)).filter(Boolean);
  const canonical = new Map((attribute?.values ?? []).map((value) => [value.label.toLowerCase(), value.label]));
  return [...new Set(list.map((entry) => canonical.get(entry.toLowerCase()) ?? entry))].slice(0, CATALOG_MAX_FILTER_VALUES);
}

/**
 * Normalises URL search params into a catalog query (invalid values are dropped, never thrown).
 * @param {Record<string, string | string[] | undefined>} params
 * @param {{ category?: string, type?: string }} [fixed] values set by the route, e.g. /categories/[slug], /shop/[type]
 * @param {CatalogConfig | null} [config] the store's attributes: their keys are the filter parameters
 * @returns {CatalogQuery}
 */
export function parseCatalogQuery(params, fixed = {}, config = null) {
  const parsed = querySchema.parse(Object.fromEntries(Object.entries(params).map(([key, value]) => [key, first(value)])));
  const sorts = Object.values(CATALOG_SORTS);
  const requestedSort = sorts.includes(parsed.sort) ? parsed.sort : null;
  const sort = requestedSort === CATALOG_SORTS.RELEVANCE && !parsed.q ? CATALOG_SORTS.NEWEST : requestedSort;
  const page = Math.min(Math.max(1, Number.parseInt(parsed.page ?? "1", 10) || 1), CATALOG_MAX_PAGE);
  const [minPrice, maxPrice] =
    parsed.min !== null && parsed.max !== null && parsed.min > parsed.max ? [parsed.max, parsed.min] : [parsed.min, parsed.max];

  /** @type {Record<string, string[]>} */
  const filters = {};
  const filterable = Object.values(config?.attributes ?? {}).filter((attribute) => attribute.filterable);
  // Sorted keys: the same selection is the same (cached) query whatever the URL's parameter order.
  for (const attribute of filterable.sort((left, right) => left.key.localeCompare(right.key))) {
    if (Object.keys(filters).length >= CATALOG_MAX_FILTER_KEYS) break;
    const values = filterValues(params[attribute.key], attribute);
    if (values.length) filters[attribute.key] = values;
  }

  return {
    q: parsed.q,
    category: fixed.category ?? parsed.category,
    type: fixed.type ?? parsed.type,
    filters,
    minPrice,
    maxPrice,
    inStock: parsed.stock === "1",
    sort: sort ?? (parsed.q ? CATALOG_SORTS.RELEVANCE : CATALOG_SORTS.NEWEST),
    page,
  };
}

const priceField = priceFieldFor;

function sortSpec(query, salesMode) {
  switch (query.sort) {
    // Tiebreaks mirror the index directions (see Product indexes) so sorts are index-backed.
    case CATALOG_SORTS.PRICE_ASC:
      return { [priceField(salesMode)]: 1, _id: 1 };
    case CATALOG_SORTS.PRICE_DESC:
      return { [priceField(salesMode)]: -1, _id: -1 };
    case CATALOG_SORTS.POPULAR:
      return { popularityScore: -1, _id: -1 };
    case CATALOG_SORTS.RELEVANCE:
      return { score: { $meta: "textScore" }, _id: -1 };
    default:
      return { createdAt: -1, _id: -1 };
  }
}

/** Category plus all of its descendants, so a parent category lists its children's products. */
export function categoryIdsFor(slug, categories) {
  const root = categories.find((category) => category.slug === slug);
  if (!root) return null;
  const ids = [root.id];
  for (let index = 0; index < ids.length; index += 1) {
    for (const category of categories) {
      if (category.parentId === ids[index]) ids.push(category.id);
    }
  }
  return ids.map((id) => new mongoose.Types.ObjectId(id));
}

const andAll = (clauses) => (clauses.length ? { $and: clauses } : {});
/** Variant-level conditions as a product-level filter on the `variants` array. */
const withVariantPrefix = (conditions) => Object.fromEntries(Object.entries(conditions).map(([key, value]) => [`variants.${key}`, value]));

/**
 * Everything but the filter selections (`base`), and the selections split by
 * where their values live: product-level clauses (details, and attributes
 * that are a detail in one type and an option in another), and variant-level
 * conditions for options, which one variant must meet together.
 * @param {CatalogQuery} query
 * @param {SalesMode} salesMode
 * @param {{ id: string, slug: string, parentId: string | null }[]} categories
 * @param {"text" | "prefix"} searchMode
 * @param {{ id: string } | null} type
 * @param {{ key: string, source: "attribute" | "option" | "both" }[]} facetKeys
 */
export function buildFilters(query, salesMode, categories, searchMode, type, facetKeys) {
  const base = listedProductFilter();
  if (query.q) {
    if (searchMode === "text") base.$text = { $search: query.q };
    else base.nameLower = { $regex: `^${escapeRegex(query.q.toLowerCase())}` };
  }
  if (query.category) {
    const ids = categoryIdsFor(query.category, categories);
    base.category = ids ? { $in: ids } : new mongoose.Types.ObjectId(); // unknown category → no results
  }
  if (query.type) base.productType = type ? new mongoose.Types.ObjectId(type.id) : new mongoose.Types.ObjectId();
  if (query.minPrice !== null || query.maxPrice !== null) {
    base[priceField(salesMode)] = {
      ...(query.minPrice !== null ? { $gte: query.minPrice } : {}),
      ...(query.maxPrice !== null ? { $lte: query.maxPrice } : {}),
    };
  }
  if (query.inStock) base.stockQuantity = { $gt: 0 };

  const stock = query.inStock ? { stockQuantity: { $gt: 0 } } : {};
  /** @type {Record<string, Record<string, unknown>>} */
  const productClauses = {};
  /** @type {Record<string, Record<string, unknown>>} */
  const variantConditions = {};
  for (const { key, source } of facetKeys) {
    const values = query.filters[key];
    if (!values?.length) continue;
    const detail = { attributes: { $elemMatch: { key, value: { $in: values } } } };
    if (source === "option") variantConditions[key] = { [`options.${key}`]: { $in: values } };
    else if (source === "attribute") productClauses[key] = detail;
    else productClauses[key] = { $or: [detail, { variants: { $elemMatch: { [`options.${key}`]: { $in: values }, ...stock } } }] };
  }
  return { base, productClauses, variantConditions, stock };
}

/**
 * Product-level filter for the selections, optionally leaving one key out (a
 * filter group's own counts ignore its selection, so shoppers can pick several).
 * @param {ReturnType<typeof buildFilters>} filters
 * @param {string | null} [except]
 */
function selectionFilter(filters, except = null) {
  const clauses = Object.entries(filters.productClauses)
    .filter(([key]) => key !== except)
    .map(([, clause]) => clause);
  const variant = variantMatch(filters, except);
  if (Object.keys(variant).length > Object.keys(filters.stock).length) clauses.push({ variants: { $elemMatch: variant } });
  return andAll(clauses);
}

/** One variant's conditions: the option selections (except one key) and stock. */
function variantMatch(filters, except = null) {
  return Object.assign(
    {},
    ...Object.entries(filters.variantConditions)
      .filter(([key]) => key !== except)
      .map(([, condition]) => condition),
    filters.stock,
  );
}

/** Per key, its most common values: `[{ _id: key, values: [{ value, count }] }]`. */
const topValuesPerKey = [
  { $project: { _id: 0, k: "$_id.k", v: "$_id.v", count: 1 } },
  { $group: { _id: "$k", values: { $topN: { n: CATALOG_FACET_LIMIT, sortBy: { count: -1, v: 1 }, output: { value: "$v", count: "$count" } } } } },
];

/** Products per value of detail keys. */
const detailCounts = (keys) => [
  { $unwind: "$attributes" },
  { $match: { "attributes.key": { $in: keys } } },
  { $group: { _id: { k: "$attributes.key", v: "$attributes.value" }, count: { $sum: 1 } } },
  ...topValuesPerKey,
];

/** Products per value of option keys, counting only variants that meet `conditions`. */
const optionCounts = (keys, conditions) => [
  { $unwind: "$variants" },
  ...(Object.keys(conditions).length ? [{ $match: withVariantPrefix(conditions) }] : []),
  { $project: { pairs: { $objectToArray: { $ifNull: ["$variants.options", {}] } } } },
  { $unwind: "$pairs" },
  { $match: { "pairs.k": { $in: keys } } },
  // Once per product and value, however many of its variants have it.
  { $group: { _id: { p: "$_id", k: "$pairs.k", v: "$pairs.v" } } },
  { $group: { _id: { k: "$_id.k", v: "$_id.v" }, count: { $sum: 1 } } },
  ...topValuesPerKey,
];

/**
 * `$facet` pipelines for the filter counts. Groups without a selection share
 * one pipeline per value source; each group with a selection gets its own,
 * which ignores that selection.
 * @param {{ key: string, source: string }[]} facetKeys
 * @param {ReturnType<typeof buildFilters>} filters
 */
export function facetPipelines(facetKeys, filters) {
  const selected = (key) => key in filters.productClauses || key in filters.variantConditions;
  const match = (filter) => (Object.keys(filter).length ? [{ $match: filter }] : []);
  /** @type {Record<string, object[]>} */
  const pipelines = {};

  const sharedDetails = facetKeys.filter((facet) => !selected(facet.key) && facet.source !== "option").map((facet) => facet.key);
  const sharedOptions = facetKeys.filter((facet) => !selected(facet.key) && facet.source !== "attribute").map((facet) => facet.key);
  if (sharedDetails.length) pipelines.details = [...match(selectionFilter(filters)), ...detailCounts(sharedDetails)];
  if (sharedOptions.length) {
    pipelines.options = [...match(andAll(Object.values(filters.productClauses))), ...optionCounts(sharedOptions, variantMatch(filters))];
  }
  facetKeys.forEach((facet, index) => {
    if (!selected(facet.key)) return;
    if (facet.source !== "option") pipelines[`details${index}`] = [...match(selectionFilter(filters, facet.key)), ...detailCounts([facet.key])];
    if (facet.source !== "attribute") {
      const others = Object.entries(filters.productClauses).filter(([key]) => key !== facet.key).map(([, clause]) => clause);
      pipelines[`options${index}`] = [...match(andAll(others)), ...optionCounts([facet.key], variantMatch(filters, facet.key))];
    }
  });
  return pipelines;
}

/**
 * Filter groups from the `$facet` output, in the listing's group order.
 * Sizes keep their natural order (S, M, L); other values go most common first.
 * @param {Record<string, { _id: string, values: { value: string, count: number }[] }[]>} result
 * @param {{ key: string }[]} facetKeys
 * @param {CatalogConfig} config
 * @param {import("@/features/catalog/types").CatalogTypeConfig | null} type
 * @returns {import("@/features/catalog/types").CatalogFacetGroup[]}
 */
export function facetGroupsFrom(result, facetKeys, config, type) {
  /** @type {Map<string, Map<string, number>>} */
  const counts = new Map();
  for (const [name, rows] of Object.entries(result)) {
    if (name === "total" || name === "categories") continue;
    for (const row of rows ?? []) {
      const values = counts.get(row._id) ?? new Map();
      // A detail of one type and an option of another: the same value counts once per product either way.
      for (const { value, count } of row.values) values.set(value, (values.get(value) ?? 0) + count);
      counts.set(row._id, values);
    }
  }
  return facetKeys
    .map(({ key }) => {
      const attribute = config.attributes[key];
      const order = valueOrderOf(config, type, key);
      const hexes = new Map((attribute?.values ?? []).map((value) => [value.label, value.hex]));
      const entries = [...(counts.get(key) ?? new Map())].map(([value, count]) => ({ value: String(value), count }));
      const bySize = attribute?.schemaProperty === SCHEMA_PROPERTIES.SIZE;
      entries.sort((left, right) =>
        bySize
          ? rankOf(order, left.value) - rankOf(order, right.value) || left.value.localeCompare(right.value, "en", { numeric: true })
          : right.count - left.count || left.value.localeCompare(right.value),
      );
      return {
        key,
        name: attribute?.name ?? key,
        input: attribute?.input ?? "select",
        values: entries.slice(0, CATALOG_FACET_LIMIT).map((entry) => (hexes.get(entry.value) ? { ...entry, hex: hexes.get(entry.value) } : entry)),
      };
    })
    .filter((group) => group.values.length > 0);
}

const rankOf = (order, value) => {
  const index = order.indexOf(value);
  return index === -1 ? order.length : index;
};

/** The type a query is scoped to, the filter groups it offers and the filters it applies. */
function scopeOf(config, query) {
  const type = query.type ? typeBySlug(config, query.type) : null;
  return { type, facetKeys: facetKeysFor(config, type), filterKeys: filterKeysFor(config, type, query.filters) };
}

/**
 * Total matches and filter counts. Depends on the filters only (not page or
 * sort), so it is cached separately and reused while shoppers page and re-sort.
 * @param {string} tenantId
 * @param {SalesMode} salesMode
 * @param {CatalogQuery} filters query with page/sort normalised away
 * @param {"text" | "prefix"} searchMode
 */
async function countCatalog(tenantId, salesMode, filters, searchMode) {
  "use cache";
  cacheLife("minutes");
  cacheTag(catalogCacheTag(tenantId));

  await connectDB();
  const [categories, config] = await Promise.all([loadCategoryTree(tenantId), getCatalogConfig(tenantId)]);
  const { type, facetKeys, filterKeys } = scopeOf(config, filters);
  const built = buildFilters(filters, salesMode, categories, searchMode, type, filterKeys);
  const price = priceField(salesMode);
  const selection = selectionFilter(built);
  const [facetResult] = await runWithTenant(tenantId, () =>
    Product.aggregate([
      { $match: built.base },
      // Only the fields counts need, so large catalogues stay well within memory limits.
      { $project: { category: 1, attributes: 1, "variants.options": 1, "variants.stockQuantity": 1, [price]: 1 } },
      {
        $facet: {
          ...facetPipelines(facetKeys, built),
          // A type's listing lists only the categories holding that type, with its own counts.
          ...(filters.type
            ? { categories: [...(Object.keys(selection).length ? [{ $match: selection }] : []), { $group: { _id: "$category", count: { $sum: 1 } } }] }
            : {}),
          // The count, and the price span the price filter's placeholders show.
          total: [
            ...(Object.keys(selection).length ? [{ $match: selection }] : []),
            { $group: { _id: null, n: { $sum: 1 }, min: { $min: `$${price}` }, max: { $max: `$${price}` } } },
          ],
        },
      },
    ]),
  );
  const summary = facetResult?.total?.[0];
  return {
    total: summary?.n ?? 0,
    priceRange: summary && Number.isFinite(summary.min) && Number.isFinite(summary.max) ? { min: summary.min, max: summary.max } : null,
    facets: facetResult ? facetGroupsFrom(facetResult, facetKeys, config, type) : [],
    categoryCounts: filters.type ? Object.fromEntries((facetResult?.categories ?? []).map((row) => [String(row._id), row.count])) : null,
  };
}

async function listCatalogPage(query, salesMode, categories, searchMode, config) {
  const { type, filterKeys } = scopeOf(config, query);
  const built = buildFilters(query, salesMode, categories, searchMode, type, filterKeys);
  const projection = Object.fromEntries(CARD_FIELDS.split(" ").map((field) => [field, 1]));
  if (searchMode === "text" && query.q) projection.score = { $meta: "textScore" };
  const sort = query.sort === CATALOG_SORTS.RELEVANCE && searchMode !== "text" ? { createdAt: -1, _id: -1 } : sortSpec(query, salesMode);
  return Product.find({ ...built.base, ...selectionFilter(built) }, projection)
    .sort(sort)
    .skip((query.page - 1) * CATALOG_PAGE_SIZE)
    .limit(CATALOG_PAGE_SIZE)
    .lean();
}

/**
 * One page of the storefront catalog with filter counts.
 * @param {string} tenantId
 * @param {SalesMode} salesMode
 * @param {CatalogQuery} query
 * @returns {Promise<import("@/features/catalog/types").CatalogResult>}
 */
export async function searchCatalog(tenantId, salesMode, query) {
  "use cache";
  cacheLife("minutes");
  cacheTag(catalogCacheTag(tenantId));

  await connectDB();
  const filters = { ...query, page: 1, sort: CATALOG_SORTS.NEWEST };
  const [categories, config, textCounts] = await Promise.all([
    loadCategoryTree(tenantId),
    getCatalogConfig(tenantId),
    countCatalog(tenantId, salesMode, filters, "text"),
  ]);
  // Text search matches whole words; fall back to a name prefix ("bana" → "Banarasi …").
  const searchMode = query.q && textCounts.total === 0 ? "prefix" : "text";
  const counts = searchMode === "prefix" ? await countCatalog(tenantId, salesMode, filters, "prefix") : textCounts;
  const items =
    counts.total > 0 ? await runWithTenant(tenantId, () => listCatalogPage(query, salesMode, categories, searchMode, config)) : [];

  return {
    items: items.map((doc) => toProductCard(doc, salesMode)),
    total: counts.total,
    page: query.page,
    pageCount: Math.min(Math.ceil(counts.total / CATALOG_PAGE_SIZE), CATALOG_MAX_PAGE),
    priceRange: counts.priceRange,
    facets: counts.facets,
    categoryCounts: counts.categoryCounts,
  };
}

/** @param {string} tenantId */
export async function loadCategoryTree(tenantId) {
  const rows = await runWithTenant(tenantId, () =>
    Category.find({ isActive: true }).select("slug parentCategory").lean(),
  );
  return rows.map((row) => ({
    id: String(row._id),
    slug: row.slug,
    parentId: row.parentCategory ? String(row.parentCategory) : null,
  }));
}

/**
 * Active categories with their product counts, in display order.
 * @param {string} tenantId
 * @returns {Promise<import("@/features/catalog/types").CategorySummary[]>}
 */
export async function getCategories(tenantId) {
  "use cache";
  cacheLife("hours");
  cacheTag(catalogCacheTag(tenantId));

  await connectDB();
  return runWithTenant(tenantId, async () => {
    const [categories, counts] = await Promise.all([
      Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean(),
      Product.aggregate([
        { $match: listedProductFilter() },
        { $group: { _id: "$category", count: { $sum: 1 }, lastModified: { $max: "$updatedAt" } } },
      ]),
    ]);
    const byCategory = new Map(counts.map((row) => [String(row._id), row]));
    return categories.map((category) => {
      const products = byCategory.get(String(category._id));
      // The listing changes when the category or any of its products does (sitemap lastmod).
      const lastModified = [category.updatedAt, products?.lastModified]
        .filter(Boolean)
        .map((date) => new Date(date).getTime())
        .reduce((latest, time) => Math.max(latest, time), 0);
      return {
        id: String(category._id),
        name: category.name,
        slug: category.slug,
        description: category.description ?? "",
        imageUrl: category.image?.url ?? "",
        parentId: category.parentCategory ? String(category.parentCategory) : null,
        productCount: products?.count ?? 0,
        lastModified: lastModified ? new Date(lastModified).toISOString() : null,
      };
    });
  });
}

/**
 * Where a renamed product lives now: the current slug of the listed product
 * that used to have `slug`, so its old address redirects permanently (links
 * and rankings carry over) instead of answering 404.
 * @param {string} tenantId
 * @param {string} slug
 * @returns {Promise<string | null>}
 */
export async function findMovedProductSlug(tenantId, slug) {
  "use cache";
  cacheLife("hours");
  cacheTag(catalogCacheTag(tenantId));

  await connectDB();
  const doc = await runWithTenant(tenantId, () =>
    Product.findOne({ previousSlugs: slug.toLowerCase(), ...listedProductFilter() }).select("slug").lean(),
  );
  return doc?.slug ?? null;
}

/**
 * Where a renamed category lives now (its slug follows its name).
 * @param {string} tenantId
 * @param {string} slug
 * @returns {Promise<string | null>}
 */
export async function findMovedCategorySlug(tenantId, slug) {
  "use cache";
  cacheLife("hours");
  cacheTag(catalogCacheTag(tenantId));

  await connectDB();
  const doc = await runWithTenant(tenantId, () =>
    Category.findOne({ previousSlugs: slug.toLowerCase(), isActive: true }).select("slug").lean(),
  );
  return doc?.slug ?? null;
}

/**
 * Where a renamed product type's listing lives now.
 * @param {string} tenantId
 * @param {string} slug
 * @returns {Promise<string | null>}
 */
export async function findMovedTypeSlug(tenantId, slug) {
  "use cache";
  cacheLife("hours");
  cacheTag(catalogCacheTag(tenantId));

  await connectDB();
  const doc = await runWithTenant(tenantId, () =>
    ProductType.findOne({ previousSlugs: slug.toLowerCase(), isActive: true }).select("slug").lean(),
  );
  return doc?.slug ?? null;
}

/**
 * @param {string} tenantId
 * @param {SalesMode} salesMode
 * @param {string} slug
 * @returns {Promise<import("@/features/catalog/types").ProductDetailData | null>}
 */
export async function getProductDetail(tenantId, salesMode, slug) {
  "use cache";
  cacheLife("minutes");
  cacheTag(catalogCacheTag(tenantId));

  await connectDB();
  const [doc, config] = await Promise.all([
    runWithTenant(tenantId, () =>
      Product.findOne({ slug: slug.toLowerCase(), ...listedProductFilter() })
        .select(DETAIL_FIELDS)
        .populate("category", "name slug")
        .lean(),
    ),
    getCatalogConfig(tenantId),
  ]);
  return doc ? toProductDetail(doc, salesMode, config) : null;
}

/**
 * Products like this one: the same type in the same category first, then the
 * same type, then the category, most popular first in each.
 * @param {string} tenantId
 * @param {SalesMode} salesMode
 * @param {string} productId
 * @param {string | null} categorySlug
 * @param {number} [limit]
 * @param {string | null} [typeId]
 */
export async function getRelatedProducts(tenantId, salesMode, productId, categorySlug, limit = 8, typeId = null) {
  "use cache";
  cacheLife("hours");
  cacheTag(catalogCacheTag(tenantId));

  await connectDB();
  const categories = categorySlug ? await loadCategoryTree(tenantId) : [];
  const categoryIds = categorySlug ? categoryIdsFor(categorySlug, categories) : null;
  const type = typeId && mongoose.isValidObjectId(typeId) ? new mongoose.Types.ObjectId(typeId) : null;
  const exclude = [new mongoose.Types.ObjectId(productId)];
  const scopes = [
    ...(type && categoryIds ? [{ productType: type, category: { $in: categoryIds } }] : []),
    ...(type ? [{ productType: type }] : []),
    ...(categoryIds ? [{ category: { $in: categoryIds } }] : []),
    ...(!type && !categoryIds ? [{}] : []),
  ];
  return runWithTenant(tenantId, async () => {
    const picked = [];
    for (const scope of scopes) {
      if (picked.length >= limit) break;
      const docs = await Product.find({ ...listedProductFilter(), ...scope, _id: { $nin: [...exclude, ...picked.map((doc) => doc._id)] } })
        .sort({ popularityScore: -1, _id: -1 })
        .limit(limit - picked.length)
        .select(CARD_FIELDS)
        .lean();
      picked.push(...docs);
    }
    return picked.map((doc) => toProductCard(doc, salesMode));
  });
}

/**
 * Featured products, topped up with the newest ones.
 * @param {string} tenantId
 * @param {SalesMode} salesMode
 */
export async function getFeaturedProducts(tenantId, salesMode, limit = 8) {
  "use cache";
  cacheLife("hours");
  cacheTag(catalogCacheTag(tenantId));

  await connectDB();
  const docs = await runWithTenant(tenantId, () =>
    Product.find(listedProductFilter())
      .sort({ featured: -1, createdAt: -1 })
      .limit(limit)
      .select(CARD_FIELDS)
      .lean(),
  );
  return docs.map((doc) => toProductCard(doc, salesMode));
}

/**
 * Cards for specific products (wishlist, recently viewed), in the given order.
 * Not cached: the id list is per shopper.
 * @param {string} tenantId
 * @param {SalesMode} salesMode
 * @param {string[]} ids
 */
export async function getProductCardsByIds(tenantId, salesMode, ids) {
  const valid = [...new Set(ids)].filter((id) => mongoose.isValidObjectId(id)).slice(0, 100);
  if (!valid.length) return [];
  await connectDB();
  const docs = await runWithTenant(tenantId, () =>
    Product.find({ _id: { $in: valid }, ...listedProductFilter() }).select(CARD_FIELDS).lean(),
  );
  const byId = new Map(docs.map((doc) => [String(doc._id), doc]));
  return valid.map((id) => byId.get(id)).filter(Boolean).map((doc) => toProductCard(doc, salesMode));
}

/**
 * Search-as-you-type suggestions: name prefix first, then text matches.
 * @param {string} tenantId
 * @param {SalesMode} salesMode
 * @param {string} term
 * @returns {Promise<import("@/features/catalog/types").ProductSuggestion[]>}
 */
export async function suggestProducts(tenantId, salesMode, term, limit = 6) {
  "use cache";
  cacheLife("minutes");
  cacheTag(catalogCacheTag(tenantId));

  const q = term.trim().toLowerCase().slice(0, 60);
  if (q.length < 2) return [];
  await connectDB();
  return runWithTenant(tenantId, async () => {
    const fields = "name slug images variants colorMedia price wholesalePrice";
    const prefix = await Product.find({ ...listedProductFilter(), nameLower: { $regex: `^${escapeRegex(q)}` } })
      .sort({ nameLower: 1 })
      .limit(limit)
      .select(fields)
      .lean();
    const extra =
      prefix.length < limit
        ? await Product.find(
            { ...listedProductFilter(), $text: { $search: q }, _id: { $nin: prefix.map((doc) => doc._id) } },
            { score: { $meta: "textScore" } },
          )
            .sort({ score: { $meta: "textScore" } })
            .limit(limit - prefix.length)
            .select(fields)
            .lean()
        : [];
    return [...prefix, ...extra].map((doc) => ({
      slug: doc.slug,
      name: doc.name,
      imageUrl: toProductCard(doc, salesMode).image?.url ?? toCatalogImage(doc.images?.[0], doc.name)?.url ?? "",
      price: basePriceFor(doc, salesMode),
    }));
  });
}

/**
 * Most popular slugs to prerender at build time; the rest render on first visit.
 * @param {string} tenantId
 */
export async function getPopularProductSlugs(tenantId, limit = 100) {
  await connectDB();
  const docs = await runWithTenant(tenantId, () =>
    Product.find(listedProductFilter()).sort({ popularityScore: -1 }).limit(limit).select("slug").lean(),
  );
  return docs.map((doc) => doc.slug);
}

/**
 * One page of listed products for the sitemap: slug, update time and photo
 * URLs. Oldest first (index-backed), so new products land in the last file
 * and earlier files stay unchanged.
 * @param {string} tenantId
 * @param {number} page 0-based
 * @param {number} pageSize
 */
export async function listProductSitemapEntries(tenantId, page, pageSize) {
  await connectDB();
  return runWithTenant(tenantId, () =>
    Product.find(listedProductFilter())
      .sort({ createdAt: 1, _id: 1 })
      .skip(page * pageSize)
      .limit(pageSize)
      .select(
        "slug updatedAt images.url images.secureUrl images.isPrimary images.sortOrder colorMedia.images.url colorMedia.images.secureUrl colorMedia.images.isPrimary colorMedia.images.sortOrder variants.sortOrder variants.images.url variants.images.secureUrl variants.images.isPrimary variants.images.sortOrder",
      )
      .lean(),
  );
}
