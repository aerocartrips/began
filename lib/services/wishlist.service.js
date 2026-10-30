import mongoose from "mongoose";
import { ApiError } from "@/lib/utils/api-error";
import { Wishlist } from "@/lib/db/models/Wishlist";
import { Product } from "@/lib/db/models/Product";

async function getOrCreateWishlist(userId) {
  let wishlist = await Wishlist.findOne({ user: userId }).populate("products");
  if (!wishlist) {
    wishlist = await Wishlist.create({ user: userId, products: [] });
    wishlist = await Wishlist.findById(wishlist._id).populate("products");
  }
  return wishlist;
}

export async function getWishlist(userId) {
  return getOrCreateWishlist(userId);
}

export async function addWishlistProduct(userId, productId) {
  if (!mongoose.isValidObjectId(productId)) {
    throw new ApiError(422, "Validation failed.", [
      { field: "productId", message: "Invalid product id." },
    ]);
  }
  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, "Product not found.");

  const wishlist = await getOrCreateWishlist(userId);
  const exists = wishlist.products.some((entry) => String(entry._id ?? entry) === productId);
  if (!exists) wishlist.products.push(productId);
  await wishlist.save();
  return Wishlist.findById(wishlist._id).populate("products");
}

export async function removeWishlistProduct(userId, productId) {
  if (!mongoose.isValidObjectId(productId)) {
    throw new ApiError(422, "Validation failed.", [
      { field: "productId", message: "Invalid product id." },
    ]);
  }
  const wishlist = await getOrCreateWishlist(userId);
  wishlist.products = wishlist.products.filter((entry) => String(entry._id ?? entry) !== productId);
  await wishlist.save();
  return Wishlist.findById(wishlist._id).populate("products");
}
