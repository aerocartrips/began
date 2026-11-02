import mongoose from "mongoose";
import { ApiError } from "@/lib/utils/api-error";
import { Wishlist } from "@/lib/db/models/Wishlist";
import { Product } from "@/lib/db/models/Product";
import { PRODUCT_STATUS } from "@/lib/constants/product-status";

const MAX_ITEMS = 200;

function assertProductId(productId) {
  if (!mongoose.isValidObjectId(productId)) {
    throw new ApiError(422, "Validation failed.", [{ field: "productId", message: "Invalid product id." }]);
  }
}

const toIds = (wishlist) => (wishlist?.products ?? []).map(String);

/** Product ids saved by the customer, newest first. */
export async function getWishlistIds(userId) {
  return toIds(await Wishlist.findOne({ user: userId }).select("products").lean());
}

export async function addWishlistProduct(userId, productId) {
  assertProductId(productId);
  if (!(await Product.exists({ _id: productId, status: PRODUCT_STATUS.ACTIVE }))) {
    throw new ApiError(404, "Product not found.");
  }
  const wishlist = await Wishlist.findOneAndUpdate(
    { user: userId },
    { $addToSet: { products: productId } },
    { upsert: true, returnDocument: "after", projection: { products: 1 } },
  ).lean();
  return toIds(wishlist);
}

export async function removeWishlistProduct(userId, productId) {
  assertProductId(productId);
  const wishlist = await Wishlist.findOneAndUpdate(
    { user: userId },
    { $pull: { products: productId } },
    { returnDocument: "after", projection: { products: 1 } },
  ).lean();
  return toIds(wishlist);
}

/**
 * Merges ids saved while signed out into the account wishlist and returns the
 * combined list (existing, active products only).
 * @param {unknown} userId
 * @param {string[]} productIds
 */
export async function mergeWishlist(userId, productIds) {
  const candidates = [...new Set(productIds)].filter((id) => mongoose.isValidObjectId(id)).slice(0, MAX_ITEMS);
  const active = candidates.length
    ? await Product.find({ _id: { $in: candidates }, status: PRODUCT_STATUS.ACTIVE }).distinct("_id")
    : [];
  const wishlist = await Wishlist.findOneAndUpdate(
    { user: userId },
    { $addToSet: { products: { $each: active } } },
    { upsert: true, returnDocument: "after", projection: { products: 1 } },
  ).lean();
  return toIds(wishlist).slice(-MAX_ITEMS);
}
