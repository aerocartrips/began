import mongoose from "mongoose";
import { z } from "zod";
import { cacheLife, cacheTag } from "next/cache";
import { connectDB } from "@/lib/db/connect";
import { Product } from "@/lib/db/models/Product";
import { Category } from "@/lib/db/models/Category";
import { Attribute } from "@/lib/db/models/Attribute";
import { PRODUCT_STATUS } from "@/lib/constants/product-status";
import { ATTRIBUTE_TYPES, CATALOG_MAX_PAGE, CATALOG_PAGE_SIZE, CATALOG_SORTS } from "@/lib/constants/catalog";
import { catalogCacheTag } from "@/lib/catalog/catalog-cache";
import { CARD_FIELDS, DETAIL_FIELDS, toCatalogImage, toProductCard, toProductDetail } from "@/lib/catalog/dto";
import { basePriceFor, priceFieldFor } from "@/lib/catalog/pricing";
import { runWithTenant } from "@/lib/tenant/context";
import { escapeRegex } from "@/lib/utils/escape-regex";

/**
 * Storefront catalog reads. Every function takes the tenant id and sales mode
 * explicitly: they are part of each cache key, so one store's cached results
 * can never be served to another. Entries are invalidated by product, category
 * and attribute writes (catalogCacheTag).
 *
 * @typedef {import("@/features/catalog/types").CatalogQuery} CatalogQuery
 * @typedef {"wholesale" | "retail"} SalesMode
 */

const FACET_FIELDS = { fabric: "fabric", weave: "weavingType", occasion: "occasion", color: "colors" };
const FACET_LIMIT = 40;

const listParam = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) =>
    [...new Set((Array.isArray(value) ? value : value ? [value] : []).map((entry) => entry.trim()).filter(Boolean))]
      .slice(0, 12)
      .map((entry) => entry.slice(0, 80)),
  );

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
  fabric: listParam,
  weave: listParam,
  occasion: listParam,
  color: listParam,
  min: priceParam,
  max: priceParam,
  stock: z.string().optional(),
  sort: z.string().optional(),
  page: z.string().optional(),
});

/**
 * Normalises URL search params into a catalog query (invalid values are dropped, never thrown).
 * @param {Record<string, string | string[] | undefined>} params
 * @param {{ category?: string }} [fixed] values set by the route, e.g. /categories/[slug]
 * @returns {CatalogQuery}
 */
export function parseCatalogQuery(params, fixed = {}) {
  const flat = Object.fromEntries(
    Object.entries(params).map(([key, value]) =>
      ["fabric", "weave", "occasion", "color"].includes(key) ? [key, value] : [key, Array.isArray(value) ? value[0] : value],
    ),
  );
  const parsed = querySchema.parse(flat);
  const sorts = Object.values(CATALOG_SORTS);
  const requestedSort = sorts.includes(parsed.sort) ? parsed.sort : null;
  const sort = requestedSort === CATALOG_SORTS.RELEVANCE && !parsed.q ? CATALOG_SORTS.NEWEST : requestedSort;
  const page = Math.min(Math.max(1, Number.parseInt(parsed.page ?? "1", 10) || 1), CATALOG_MAX_PAGE);
  const [minPrice, maxPrice] =
    parsed.min !== null && parsed.max !== null && parsed.min > parsed.max ? [parsed.max, parsed.min] : [parsed.min, parsed.max];

  return {
    q: parsed.q,
    category: fixed.category ?? parsed.category,
    fabric: parsed.fabric,
    weave: parsed.weave,
    occasion: parsed.occasion,
    color: parsed.color,
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

/**
 * Base filter (everything except the facet selections) and per-facet clauses.
 * @param {CatalogQuery} query
 * @param {SalesMode} salesMode
 * @param {{ id: string, slug: string, parentId: string | null }[]} categories
 * @param {"text" | "prefix"} searchMode
 */
function buildFilters(query, salesMode, categories, searchMode) {
  const base = { status: PRODUCT_STATUS.ACTIVE };
  if (query.q) {
    if (searchMode === "text") base.$text = { $search: query.q };
    else base.nameLower = { $regex: `^${escapeRegex(query.q.toLowerCase())}` };
  }
  if (query.category) {
    const ids = categoryIdsFor(query.category, categories);
    base.category = ids ? { $in: ids } : new mongoose.Types.ObjectId(); // unknown category → no results
  }
  if (query.minPrice !== null || query.maxPrice !== null) {
    base[priceField(salesMode)] = {
      ...(query.minPrice !== null ? { $gte: query.minPrice } : {}),
      ...(query.maxPrice !== null ? { $lte: query.maxPrice } : {}),
    };
  }
  if (query.inStock) base.stockQuantity = { $gt: 0 };

  const facetClauses = Object.fromEntries(
    Object.entries(FACET_FIELDS)
      .filter(([key]) => query[key].length)
      .map(([key, field]) => [key, { [field]: { $in: query[key] } }]),
  );
  return { base, facetClauses };
}

const andAll = (clauses) => (clauses.length ? { $and: clauses } : {});

function facetPipelinesFor(facetClauses) {
  return Object.fromEntries(
    Object.entries(FACET_FIELDS).map(([key, field]) => {
      // Each facet ignores its own selection so shoppers can pick several values.
      const others = Object.entries(facetClauses).filter(([other]) => other !== key).map(([, clause]) => clause);
      return [
        key,
        [
          ...(others.length ? [{ $match: andAll(others) }] : []),
          ...(key === "color" ? [{ $unwind: "$colors" }] : [{ $match: { [field]: { $nin: ["", null] } } }]),
          { $sortByCount: `$${field}` },
          { $limit: FACET_LIMIT },
        ],
      ];
    }),
  );
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
  const categories = await loadCategoryTree(tenantId);
  const { base, facetClauses } = buildFilters(filters, salesMode, categories, searchMode);
  const [facetResult] = await runWithTenant(tenantId, () =>
    Product.aggregate([
      { $match: base },
      // Only the fields facets need, so 50k-product stores stay well within memory limits.
      { $project: { fabric: 1, weavingType: 1, occasion: 1, colors: 1 } },
      { $facet: { ...facetPipelinesFor(facetClauses), total: [{ $match: andAll(Object.values(facetClauses)) }, { $count: "n" }] } },
    ]),
  );
  return {
    total: facetResult?.total?.[0]?.n ?? 0,
    facets: Object.fromEntries(
      Object.keys(FACET_FIELDS).map((key) => [
        key,
        (facetResult?.[key] ?? []).map((row) => ({ value: String(row._id), count: row.count })),
      ]),
    ),
  };
}

async function listCatalogPage(query, salesMode, categories, searchMode) {
  const { base, facetClauses } = buildFilters(query, salesMode, categories, searchMode);
  const projection = Object.fromEntries(CARD_FIELDS.split(" ").map((field) => [field, 1]));
  if (searchMode === "text" && query.q) projection.score = { $meta: "textScore" };
  const sort = query.sort === CATALOG_SORTS.RELEVANCE && searchMode !== "text" ? { createdAt: -1, _id: -1 } : sortSpec(query, salesMode);
  return Product.find({ ...base, ...andAll(Object.values(facetClauses)) }, projection)
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
  const [categories, colorHexes, textCounts] = await Promise.all([
    loadCategoryTree(tenantId),
    loadColorHexes(tenantId),
    countCatalog(tenantId, salesMode, filters, "text"),
  ]);
  // Text search matches whole words; fall back to a name prefix ("bana" → "Banarasi …").
  const searchMode = query.q && textCounts.total === 0 ? "prefix" : "text";
  const counts = searchMode === "prefix" ? await countCatalog(tenantId, salesMode, filters, "prefix") : textCounts;
  const items = counts.total > 0 ? await runWithTenant(tenantId, () => listCatalogPage(query, salesMode, categories, searchMode)) : [];

  return {
    items: items.map((doc) => toProductCard(doc, salesMode)),
    total: counts.total,
    page: query.page,
    pageCount: Math.min(Math.ceil(counts.total / CATALOG_PAGE_SIZE), CATALOG_MAX_PAGE),
    facets: {
      ...counts.facets,
      color: counts.facets.color.map((facet) => ({ ...facet, hex: colorHexes[facet.value.toLowerCase()] })),
    },
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

/** @param {string} tenantId */
async function loadColorHexes(tenantId) {
  const rows = await runWithTenant(tenantId, () =>
    Attribute.find({ type: ATTRIBUTE_TYPES.COLOR, isActive: true }).select("label hex").lean(),
  );
  return Object.fromEntries(rows.filter((row) => row.hex).map((row) => [row.label.toLowerCase(), row.hex]));
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
      Product.aggregate([{ $match: { status: PRODUCT_STATUS.ACTIVE } }, { $group: { _id: "$category", count: { $sum: 1 } } }]),
    ]);
    const countMap = new Map(counts.map((row) => [String(row._id), row.count]));
    return categories.map((category) => ({
      id: String(category._id),
      name: category.name,
      slug: category.slug,
      description: category.description ?? "",
      imageUrl: category.image?.url ?? "",
      productCount: countMap.get(String(category._id)) ?? 0,
    }));
  });
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
  const doc = await runWithTenant(tenantId, () =>
    Product.findOne({ slug: slug.toLowerCase(), status: PRODUCT_STATUS.ACTIVE })
      .select(DETAIL_FIELDS)
      .populate("category", "name slug")
      .lean(),
  );
  return doc ? toProductDetail(doc, salesMode) : null;
}

/**
 * Products from the same category, most popular first.
 * @param {string} tenantId
 * @param {SalesMode} salesMode
 * @param {string} productId
 * @param {string | null} categorySlug
 */
export async function getRelatedProducts(tenantId, salesMode, productId, categorySlug, limit = 8) {
  "use cache";
  cacheLife("hours");
  cacheTag(catalogCacheTag(tenantId));

  await connectDB();
  const categories = categorySlug ? await loadCategoryTree(tenantId) : [];
  const categoryIds = categorySlug ? categoryIdsFor(categorySlug, categories) : null;
  const docs = await runWithTenant(tenantId, () =>
    Product.find({
      status: PRODUCT_STATUS.ACTIVE,
      _id: { $ne: new mongoose.Types.ObjectId(productId) },
      ...(categoryIds ? { category: { $in: categoryIds } } : {}),
    })
      .sort({ popularityScore: -1, _id: -1 })
      .limit(limit)
      .select(CARD_FIELDS)
      .lean(),
  );
  return docs.map((doc) => toProductCard(doc, salesMode));
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
    Product.find({ status: PRODUCT_STATUS.ACTIVE })
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
    Product.find({ _id: { $in: valid }, status: PRODUCT_STATUS.ACTIVE }).select(CARD_FIELDS).lean(),
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
    const fields = "name slug images variants price wholesalePrice";
    const prefix = await Product.find({ status: PRODUCT_STATUS.ACTIVE, nameLower: { $regex: `^${escapeRegex(q)}` } })
      .sort({ nameLower: 1 })
      .limit(limit)
      .select(fields)
      .lean();
    const extra =
      prefix.length < limit
        ? await Product.find(
            { status: PRODUCT_STATUS.ACTIVE, $text: { $search: q }, _id: { $nin: prefix.map((doc) => doc._id) } },
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
      imageUrl: toCatalogImage(doc.images?.[0] ?? doc.variants?.[0]?.images?.[0], doc.name)?.url ?? "",
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
    Product.find({ status: PRODUCT_STATUS.ACTIVE }).sort({ popularityScore: -1 }).limit(limit).select("slug").lean(),
  );
  return docs.map((doc) => doc.slug);
}

/**
 * Every active product slug and update time, for the sitemap (paged).
 * @param {string} tenantId
 */
export async function listProductSitemapEntries(tenantId, page, pageSize) {
  await connectDB();
  return runWithTenant(tenantId, () =>
    Product.find({ status: PRODUCT_STATUS.ACTIVE })
      .sort({ _id: 1 })
      .skip(page * pageSize)
      .limit(pageSize)
      .select("slug updatedAt")
      .lean(),
  );
}

/**
 * Active attribute values grouped by type, for filters and product forms.
 * @param {string} tenantId
 */
export async function getAttributeOptions(tenantId) {
  "use cache";
  cacheLife("hours");
  cacheTag(catalogCacheTag(tenantId));

  await connectDB();
  const rows = await runWithTenant(tenantId, () =>
    Attribute.find({ isActive: true }).sort({ type: 1, sortOrder: 1, label: 1 }).select("type label slug hex").lean(),
  );
  const grouped = Object.fromEntries(Object.values(ATTRIBUTE_TYPES).map((type) => [type, []]));
  for (const row of rows) grouped[row.type].push({ label: row.label, slug: row.slug, hex: row.hex || "" });
  return grouped;
}
