import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { Product } from "@/lib/db/models/Product";
import { Category } from "@/lib/db/models/Category";
import { Order } from "@/lib/db/models/Order";
import { Wishlist } from "@/lib/db/models/Wishlist";
import { listedProductFilter } from "@/lib/constants/product-status";
import { CARD_FIELDS, toProductCard } from "@/lib/catalog/dto";
import { basePriceFor } from "@/lib/catalog/pricing";
import { getPopularProducts } from "@/lib/catalog/home";
import { buildInterestProfile, rankRecommendations, strongestInterest, topDetailValues } from "@/lib/catalog/interest";
import { facetKeysFor, getCatalogConfig, typeById } from "@/lib/catalog/catalog-config";
import { runWithTenant } from "@/lib/tenant/context";

/**
 * "Picked for you": per-shopper and never cached across shoppers.
 *
 * Signals come from the shopper's own browser (recently viewed, wishlist and
 * cart ids it already holds) plus, when signed in, their account wishlist and
 * recent orders. Nothing is stored about guests. Products the shopper has
 * already engaged with are excluded; those have their own rows and pages.
 */

const MAX_IDS_PER_SIGNAL = 20;
const RECENT_ORDERS = 10;
const CANDIDATE_POOL = 150;
const POPULAR_POOL = 40;
const TOP_VALUES = 3;
const ATTRIBUTE_FIELDS = "category productType attributes colors price wholesalePrice";

const validIds = (ids) =>
  [...new Set((ids ?? []).filter((id) => typeof id === "string" && mongoose.isValidObjectId(id)))].slice(0, MAX_IDS_PER_SIGNAL);

const topValues = (bucket) =>
  Object.entries(bucket)
    .sort((left, right) => right[1] - left[1])
    .slice(0, TOP_VALUES)
    .map(([value]) => value);


/** Account signals for a signed-in shopper: saved wishlist and recently ordered products. */
async function accountSignals(userId) {
  if (!userId) return { wishlistIds: [], purchasedIds: [] };
  const [wishlist, orders] = await Promise.all([
    Wishlist.findOne({ user: userId }).select("products").lean(),
    Order.find({ customer: userId }).sort({ createdAt: -1 }).limit(RECENT_ORDERS).select("items.product").lean(),
  ]);
  return {
    wishlistIds: (wishlist?.products ?? []).map(String).reverse(),
    purchasedIds: orders.flatMap((order) => order.items.map((item) => String(item.product))),
  };
}

/**
 * @param {string} tenantId
 * @param {"wholesale" | "retail"} salesMode
 * @param {{ viewedIds?: string[], wishlistIds?: string[], cartIds?: string[], userId?: unknown, limit?: number }} input
 * @returns {Promise<import("@/features/catalog/types").Recommendations>}
 */
export async function getRecommendations(tenantId, salesMode, { viewedIds = [], wishlistIds = [], cartIds = [], userId = null, limit = 10 }) {
  await connectDB();
  return runWithTenant(tenantId, async () => {
    const [account, config] = await Promise.all([accountSignals(userId), getCatalogConfig(tenantId)]);
    const lists = {
      view: validIds(viewedIds),
      wishlist: validIds([...wishlistIds, ...account.wishlistIds]),
      cart: validIds(cartIds),
      purchase: validIds(account.purchasedIds),
    };
    const signalIds = [...new Set(Object.values(lists).flat())];
    const popularFallback = async () => ({ personalized: false, reason: "", items: await getPopularProducts(tenantId, salesMode, limit) });
    if (!signalIds.length) return popularFallback();

    // Inactive products still tell us what the shopper likes.
    const signalDocs = await Product.find({ _id: { $in: signalIds } }).select(ATTRIBUTE_FIELDS).lean();
    const byId = new Map(signalDocs.map((doc) => [String(doc._id), { ...doc, price: basePriceFor(doc, salesMode) }]));
    // Interest is read from the details shoppers can filter by (fabric, fit…), not free text.
    const detailKeys = facetKeysFor(config, null).filter((facet) => facet.source !== "option").map((facet) => facet.key);
    const profile = buildInterestProfile(
      Object.entries(lists).flatMap(([type, ids]) =>
        ids.map((id, rank) => ({ product: byId.get(id), type: /** @type {any} */ (type), rank })).filter((signal) => signal.product),
      ),
      { detailKeys },
    );
    // Ids unknown to this store (deleted products, another store's ids) tell us nothing.
    if (!profile.total) return popularFallback();

    const exclude = new Set(signalIds);
    // Values as products spell them (the profile is case-normalised), for exact, index-backed matches.
    const spelled = new Map(
      signalDocs.flatMap((doc) => (doc.attributes ?? []).map((entry) => [`${entry.key}:${entry.value.trim().toLowerCase()}`, entry.value])),
    );
    const interestClauses = [
      ...(Object.keys(profile.category).length ? [{ category: { $in: topValues(profile.category) } }] : []),
      ...(Object.keys(profile.type).length ? [{ productType: { $in: topValues(profile.type) } }] : []),
      ...topDetailValues(profile).map(({ key, value }) => ({
        attributes: { $elemMatch: { key, value: spelled.get(`${key}:${value}`) ?? value } },
      })),
    ];
    const fields = `${CARD_FIELDS} ${ATTRIBUTE_FIELDS} popularityScore`;
    const notSeen = { ...listedProductFilter(), _id: { $nin: [...exclude] } };
    const [matching, popular] = await Promise.all([
      interestClauses.length
        ? Product.find({ ...notSeen, $or: interestClauses }).sort({ popularityScore: -1, _id: -1 }).limit(CANDIDATE_POOL).select(fields).lean()
        : [],
      Product.find(notSeen).sort({ popularityScore: -1, _id: -1 }).limit(POPULAR_POOL).select(fields).lean(),
    ]);

    const ranked = rankRecommendations(
      [...matching, ...popular].map((doc) => ({ ...doc, price: basePriceFor(doc, salesMode) })),
      profile,
      { limit, exclude },
    );

    const interest = strongestInterest(profile);
    let label = interest?.value ?? "";
    if (interest?.dimension === "category") {
      label = (await Category.findById(interest.value).select("name").lean())?.name ?? "";
    } else if (interest?.dimension === "type") {
      label = typeById(config, interest.value)?.pluralName ?? "";
    } else if (interest) {
      // Show the value as products spell it, not the normalised form.
      label = spelled.get(`${interest.key}:${interest.value}`) ?? label;
    }

    return {
      personalized: ranked.length > 0,
      reason: label ? `Based on your interest in ${label}` : "Based on what you've browsed",
      items: ranked.map((doc) => toProductCard(doc, salesMode)),
    };
  });
}
