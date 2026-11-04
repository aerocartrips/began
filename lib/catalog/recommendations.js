import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { Product } from "@/lib/db/models/Product";
import { Category } from "@/lib/db/models/Category";
import { Order } from "@/lib/db/models/Order";
import { Wishlist } from "@/lib/db/models/Wishlist";
import { PRODUCT_STATUS } from "@/lib/constants/product-status";
import { CARD_FIELDS, toProductCard } from "@/lib/catalog/dto";
import { basePriceFor } from "@/lib/catalog/pricing";
import { getPopularProducts } from "@/lib/catalog/home";
import { buildInterestProfile, rankRecommendations, strongestInterest } from "@/lib/catalog/interest";
import { runWithTenant } from "@/lib/tenant/context";
import { escapeRegex } from "@/lib/utils/escape-regex";

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
const ATTRIBUTE_FIELDS = "category fabric weavingType occasion colors price wholesalePrice";

const validIds = (ids) =>
  [...new Set((ids ?? []).filter((id) => typeof id === "string" && mongoose.isValidObjectId(id)))].slice(0, MAX_IDS_PER_SIGNAL);

const topValues = (bucket) =>
  Object.entries(bucket)
    .sort((left, right) => right[1] - left[1])
    .slice(0, TOP_VALUES)
    .map(([value]) => value);

/** Attribute values are matched case-insensitively, as the profile normalises them. */
const anyOf = (values) => ({ $in: values.map((value) => new RegExp(`^${escapeRegex(value)}$`, "i")) });

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
    const account = await accountSignals(userId);
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
    const profile = buildInterestProfile(
      Object.entries(lists).flatMap(([type, ids]) =>
        ids.map((id, rank) => ({ product: byId.get(id), type: /** @type {any} */ (type), rank })).filter((signal) => signal.product),
      ),
    );
    // Ids unknown to this store (deleted products, another store's ids) tell us nothing.
    if (!profile.total) return popularFallback();

    const exclude = new Set(signalIds);
    const interestClauses = [
      ...(Object.keys(profile.category).length ? [{ category: { $in: topValues(profile.category) } }] : []),
      ...(Object.keys(profile.fabric).length ? [{ fabric: anyOf(topValues(profile.fabric)) }] : []),
      ...(Object.keys(profile.weave).length ? [{ weavingType: anyOf(topValues(profile.weave)) }] : []),
      ...(Object.keys(profile.occasion).length ? [{ occasion: anyOf(topValues(profile.occasion)) }] : []),
    ];
    const fields = `${CARD_FIELDS} ${ATTRIBUTE_FIELDS} popularityScore`;
    const notSeen = { status: PRODUCT_STATUS.ACTIVE, _id: { $nin: [...exclude] } };
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
    } else if (interest) {
      // Show the value as products spell it, not the normalised form.
      const field = { fabric: "fabric", weave: "weavingType", occasion: "occasion" }[interest.dimension];
      label = signalDocs.find((doc) => doc[field]?.trim().toLowerCase() === interest.value)?.[field] ?? label;
    }

    return {
      personalized: ranked.length > 0,
      reason: label ? `Based on your interest in ${label}` : "Based on what you've browsed",
      items: ranked.map((doc) => toProductCard(doc, salesMode)),
    };
  });
}
