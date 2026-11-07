import mongoose from "mongoose";
import { cacheLife, cacheTag } from "next/cache";
import { connectDB } from "@/lib/db/connect";
import { Product } from "@/lib/db/models/Product";
import { Category } from "@/lib/db/models/Category";
import { Review } from "@/lib/db/models/Review";
import { PRODUCT_STATUS } from "@/lib/constants/product-status";
import { REVIEW_MODERATION_STATUS, REVIEW_VERIFICATION_STATUS } from "@/lib/constants/review-status";
import { FEED_PAGE_SIZE } from "@/lib/constants/homepage";
import { catalogCacheTag } from "@/lib/catalog/catalog-cache";
import { CARD_FIELDS, toProductCard } from "@/lib/catalog/dto";
import { priceFieldFor } from "@/lib/catalog/pricing";
import { categoryIdsFor, loadCategoryTree } from "@/lib/catalog/query";
import { decodeFeedCursor, encodeFeedCursor, feedCursorFilter } from "@/lib/catalog/cursor";
import { runWithTenant } from "@/lib/tenant/context";
import { formatRupees } from "@/lib/format";
// Registers the User schema for review author names.
import "@/lib/db/models/User";

/**
 * Home page reads. Like lib/catalog/query.js, every function takes the tenant
 * and sales mode explicitly (they are part of the cache key) and is
 * invalidated by catalogue writes and by the product metrics job.
 *
 * @typedef {import("@/features/catalog/types").ProductCardData} ProductCardData
 * @typedef {"wholesale" | "retail"} SalesMode
 */

const ACTIVE = { status: PRODUCT_STATUS.ACTIVE };
const POPULAR_SORT = { popularityScore: -1, _id: -1 };
const PREVIEWS_PER_CATEGORY = 4;
const ATTRIBUTE_PICKS = 8;

const cards = (docs, salesMode) => docs.map((doc) => toProductCard(doc, salesMode));

/**
 * Top-level categories with product counts, starting prices and preview
 * photos, rolled up from subcategories. One aggregation for the whole store.
 * @param {string} tenantId
 * @param {SalesMode} salesMode
 * @returns {Promise<import("@/features/catalog/types").CategoryOverview[]>}
 */
export async function getCategoryOverview(tenantId, salesMode) {
  "use cache";
  cacheLife("hours");
  cacheTag(catalogCacheTag(tenantId));

  await connectDB();
  const field = priceFieldFor(salesMode);
  const [categories, groups] = await runWithTenant(tenantId, () =>
    Promise.all([
      Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).select("name slug image parentCategory").lean(),
      Product.aggregate([
        { $match: ACTIVE },
        { $sort: POPULAR_SORT },
        {
          $group: {
            _id: "$category",
            count: { $sum: 1 },
            minPrice: { $min: `$${field}` },
            previews: {
              $firstN: {
                n: PREVIEWS_PER_CATEGORY,
                input: { _id: "$_id", name: "$name", images: "$images", variants: { $slice: ["$variants", 1] } },
              },
            },
          },
        },
      ]),
    ]),
  );

  const byId = new Map(categories.map((category) => [String(category._id), category]));
  const rootOf = (id) => {
    let current = byId.get(id);
    // Bounded walk: a corrupt parent cycle cannot loop forever.
    for (let depth = 0; current?.parentCategory && depth < 10; depth += 1) {
      const parent = byId.get(String(current.parentCategory));
      if (!parent) break;
      current = parent;
    }
    return current ? String(current._id) : null;
  };

  /** @type {Map<string, { count: number, minPrice: number, previews: any[] }>} */
  const totals = new Map();
  for (const group of groups) {
    const root = rootOf(String(group._id));
    if (!root) continue; // product in an inactive or deleted category
    const total = totals.get(root) ?? { count: 0, minPrice: Infinity, previews: [] };
    total.count += group.count;
    total.minPrice = Math.min(total.minPrice, group.minPrice ?? Infinity);
    // The root's own products first, then its subcategories'.
    total.previews = String(group._id) === root ? [...group.previews, ...total.previews] : [...total.previews, ...group.previews];
    totals.set(root, total);
  }

  return categories
    .filter((category) => !category.parentCategory || !byId.has(String(category.parentCategory)))
    .map((category) => ({ category, total: totals.get(String(category._id)) }))
    .filter(({ total }) => total?.count > 0)
    .map(({ category, total }) => ({
      id: String(category._id),
      name: category.name,
      slug: category.slug,
      imageUrl: category.image?.url ?? "",
      productCount: total.count,
      startingPrice: Number.isFinite(total.minPrice) ? total.minPrice : 0,
      previews: total.previews
        .map((doc) => toProductCard(doc, salesMode).image)
        .filter(Boolean)
        .slice(0, PREVIEWS_PER_CATEGORY),
    }));
}

/**
 * The three product tabs. Best sellers need real paid orders and trending
 * needs recent activity above the threshold (see the metrics job), so either
 * list is empty, and its tab hidden, until the data supports it.
 * @param {string} tenantId
 * @param {SalesMode} salesMode
 * @param {number} limit
 */
export async function getProductTabs(tenantId, salesMode, limit) {
  "use cache";
  cacheLife("hours");
  cacheTag(catalogCacheTag(tenantId));

  await connectDB();
  const [bestsellers, newest, trending] = await runWithTenant(tenantId, () =>
    Promise.all([
      Product.find({ ...ACTIVE, salesCount: { $gt: 0 } })
        .sort({ salesCount: -1, popularityScore: -1, _id: -1 })
        .limit(limit)
        .select(CARD_FIELDS)
        .lean(),
      Product.find(ACTIVE).sort({ createdAt: -1, _id: -1 }).limit(limit).select(CARD_FIELDS).lean(),
      Product.find({ ...ACTIVE, trendingScore: { $gt: 0 } }).sort({ trendingScore: -1, _id: -1 }).limit(limit).select(CARD_FIELDS).lean(),
    ]),
  );
  return { bestsellers: cards(bestsellers, salesMode), new: cards(newest, salesMode), trending: cards(trending, salesMode) };
}

/**
 * Most popular products: the "Picked for you" row for shoppers without history.
 * @param {string} tenantId
 * @param {SalesMode} salesMode
 * @param {number} limit
 */
export async function getPopularProducts(tenantId, salesMode, limit) {
  "use cache";
  cacheLife("hours");
  cacheTag(catalogCacheTag(tenantId));

  await connectDB();
  const docs = await runWithTenant(tenantId, () =>
    Product.find(ACTIVE).sort({ popularityScore: -1, createdAt: -1, _id: -1 }).limit(limit).select(CARD_FIELDS).lean(),
  );
  return cards(docs, salesMode);
}

/**
 * Active products in the store: the count behind "View all" on rows that
 * lead to the whole catalogue (picks, best sellers, new, trending, the feed).
 * @param {string} tenantId
 * @returns {Promise<number>}
 */
export async function getCatalogueTotal(tenantId) {
  "use cache";
  cacheLife("hours");
  cacheTag(catalogCacheTag(tenantId));

  await connectDB();
  return runWithTenant(tenantId, () => Product.countDocuments(ACTIVE));
}

/**
 * Products for an admin-configured collection row, and how many match in all
 * (the row's "View all" count).
 * @param {string} tenantId
 * @param {SalesMode} salesMode
 * @param {{ kind: string, value: string, productIds: string[], sort: string }} source
 * @param {number} limit
 * @returns {Promise<import("@/features/catalog/types").ProductList>}
 */
export async function getCollectionProducts(tenantId, salesMode, source, limit) {
  "use cache";
  cacheLife("hours");
  cacheTag(catalogCacheTag(tenantId));

  await connectDB();
  return runWithTenant(tenantId, async () => {
    if (source.kind === "products") {
      const ids = source.productIds.filter((id) => mongoose.isValidObjectId(id)).slice(0, limit);
      const docs = ids.length ? await Product.find({ ...ACTIVE, _id: { $in: ids } }).select(CARD_FIELDS).lean() : [];
      const byId = new Map(docs.map((doc) => [String(doc._id), doc]));
      const items = cards(ids.map((id) => byId.get(id)).filter(Boolean), salesMode);
      return { items, total: items.length };
    }

    const filter = { ...ACTIVE };
    if (source.kind === "category") {
      const ids = categoryIdsFor(source.value, await loadCategoryTree(tenantId));
      if (!ids) return { items: [], total: 0 };
      filter.category = { $in: ids };
    } else {
      const field = { fabric: "fabric", weave: "weavingType", occasion: "occasion" }[source.kind];
      if (!field || !source.value) return { items: [], total: 0 };
      filter[field] = source.value;
    }
    const field = priceFieldFor(salesMode);
    const sort =
      source.sort === "newest" ? { createdAt: -1, _id: -1 } : source.sort === "price-asc" ? { [field]: 1, _id: 1 } : POPULAR_SORT;
    const [docs, total] = await Promise.all([
      Product.find(filter).sort(sort).limit(limit).select(CARD_FIELDS).lean(),
      Product.countDocuments(filter),
    ]);
    return { items: cards(docs, salesMode), total };
  });
}

/** Rounds a price-band edge to a figure people use (₹1,450 → ₹1,500). */
function roundPrice(value) {
  const step = value < 1000 ? 50 : value < 10000 ? 100 : 500;
  return Math.max(step, Math.round(value / step) * step);
}

/**
 * One-tap shortcuts into the catalogue, from the values products actually have.
 * Groups with fewer than two options are dropped.
 * @param {string} tenantId
 * @param {SalesMode} salesMode
 * @returns {Promise<import("@/features/catalog/types").QuickPickGroup[]>}
 */
export async function getQuickPicks(tenantId, salesMode) {
  "use cache";
  cacheLife("hours");
  cacheTag(catalogCacheTag(tenantId));

  await connectDB();
  const field = priceFieldFor(salesMode);
  const top = (path) => [{ $match: { [path]: { $nin: ["", null] } } }, { $sortByCount: `$${path}` }, { $limit: ATTRIBUTE_PICKS }];
  const [result] = await runWithTenant(tenantId, () =>
    Product.aggregate([
      { $match: ACTIVE },
      { $project: { fabric: 1, weavingType: 1, occasion: 1, [field]: 1 } },
      {
        $facet: {
          fabric: top("fabric"),
          weave: top("weavingType"),
          occasion: top("occasion"),
          prices: [{ $bucketAuto: { groupBy: `$${field}`, buckets: 4 } }],
          total: [{ $count: "n" }],
        },
      },
    ]),
  );
  if (!result) return [];

  const attributeGroup = (key, title) => ({
    key,
    title,
    links: result[key].map((row) => ({
      label: String(row._id),
      href: `/products?${new URLSearchParams({ [key]: String(row._id) })}`,
      count: row.count,
    })),
  });

  // Price bands from the real price distribution, rounded to friendly edges.
  const edges = [...new Set(result.prices.slice(0, -1).map((bucket) => roundPrice(bucket._id.max)))].sort((a, b) => a - b);
  const priceLinks =
    (result.total[0]?.n ?? 0) >= 8 && edges.length >= 1
      ? [
          { label: `Under ${formatRupees(edges[0])}`, href: `/products?max=${edges[0]}` },
          ...edges.slice(1).map((edge, index) => ({
            label: `${formatRupees(edges[index])} – ${formatRupees(edge)}`,
            href: `/products?min=${edges[index]}&max=${edge}`,
          })),
          { label: `${formatRupees(edges.at(-1))} & above`, href: `/products?min=${edges.at(-1)}` },
        ]
      : [];

  return [
    attributeGroup("fabric", "Fabric"),
    attributeGroup("weave", "Weave"),
    attributeGroup("occasion", "Occasion"),
    { key: "price", title: salesMode === "wholesale" ? "Price per piece" : "Price", links: priceLinks },
  ].filter((group) => group.links.length >= 2);
}

/**
 * Recent approved 4★+ reviews from verified buyers, for active products.
 * Only the reviewer's first name is shown.
 * @param {string} tenantId
 * @param {number} limit
 * @returns {Promise<import("@/features/catalog/types").HomeReview[]>}
 */
export async function getHomeReviews(tenantId, limit) {
  "use cache";
  cacheLife("hours");
  cacheTag(catalogCacheTag(tenantId));

  await connectDB();
  const reviews = await runWithTenant(tenantId, () =>
    Review.find({
      moderationStatus: REVIEW_MODERATION_STATUS.APPROVED,
      verificationStatus: REVIEW_VERIFICATION_STATUS.VERIFIED,
      rating: { $gte: 4 },
    })
      .sort({ createdAt: -1 })
      .limit(limit * 2)
      .select("rating title comment createdAt user product")
      .populate("user", "name")
      .populate("product", "name slug status")
      .lean(),
  );
  return reviews
    .filter((review) => review.product?.status === PRODUCT_STATUS.ACTIVE)
    .slice(0, limit)
    .map((review) => ({
      id: String(review._id),
      rating: review.rating,
      title: review.title ?? "",
      comment: review.comment,
      authorName: String(review.user?.name ?? "").trim().split(/\s+/)[0] || "Verified buyer",
      createdAt: new Date(review.createdAt).toISOString(),
      product: { name: review.product.name, slug: review.product.slug },
    }));
}

/**
 * One page of the home page feed: every active product, most popular first,
 * optionally within one category. Keyset pagination (no skip), so deep pages
 * cost the same as the first.
 * @param {string} tenantId
 * @param {SalesMode} salesMode
 * @param {string} categorySlug "" for all categories
 * @param {string | null} cursor from the previous page
 * @returns {Promise<import("@/features/catalog/types").FeedPage>}
 */
export async function getFeedPage(tenantId, salesMode, categorySlug, cursor) {
  "use cache";
  cacheLife("minutes");
  cacheTag(catalogCacheTag(tenantId));

  await connectDB();
  return runWithTenant(tenantId, async () => {
    const filter = { ...ACTIVE, ...feedCursorFilter(decodeFeedCursor(cursor)) };
    if (categorySlug) {
      const ids = categoryIdsFor(categorySlug, await loadCategoryTree(tenantId));
      if (!ids) return { items: [], nextCursor: null };
      filter.category = { $in: ids };
    }
    const docs = await Product.find(filter)
      .sort(POPULAR_SORT)
      .limit(FEED_PAGE_SIZE + 1)
      .select(`${CARD_FIELDS} popularityScore`)
      .lean();
    const page = docs.slice(0, FEED_PAGE_SIZE);
    return {
      items: cards(page, salesMode),
      nextCursor: docs.length > FEED_PAGE_SIZE ? encodeFeedCursor(page.at(-1)) : null,
    };
  });
}
