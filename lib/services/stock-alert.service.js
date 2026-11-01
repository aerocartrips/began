import mongoose from "mongoose";
import { PRODUCT_STATUS } from "@/lib/constants/product-status";
import { Product } from "@/lib/db/models/Product";
import { StockAlert } from "@/lib/db/models/StockAlert";
import { ApiError } from "@/lib/utils/api-error";

/** @param {string} productId */
async function findListedProduct(productId) {
  if (!mongoose.isValidObjectId(productId)) throw new ApiError(404, "Product not found.");
  const product = await Product.findOne({ _id: productId, status: PRODUCT_STATUS.ACTIVE })
    .select("_id stockQuantity minimumOrderQuantity")
    .lean();
  if (!product) throw new ApiError(404, "Product not found.");
  return product;
}

/**
 * @param {{ _id: unknown }} user
 * @param {string} productId
 */
export async function getStockAlert(user, productId) {
  if (!mongoose.isValidObjectId(productId)) throw new ApiError(404, "Product not found.");
  const alert = await StockAlert.exists({ product: productId, customer: user._id, notifiedAt: null });
  return { subscribed: Boolean(alert) };
}

/**
 * Explicit opt-in. Re-subscribing after an alert fired re-arms it.
 * @param {{ _id: unknown }} user
 * @param {string} productId
 */
export async function subscribeStockAlert(user, productId) {
  const product = await findListedProduct(productId);
  if (product.stockQuantity >= product.minimumOrderQuantity) {
    throw new ApiError(409, "This product is already available to order.");
  }
  await StockAlert.updateOne(
    { product: product._id, customer: user._id },
    { $set: { notifiedAt: null }, $setOnInsert: { product: product._id, customer: user._id } },
    { upsert: true },
  );
  return { subscribed: true };
}

/**
 * @param {{ _id: unknown }} user
 * @param {string} productId
 */
export async function unsubscribeStockAlert(user, productId) {
  if (!mongoose.isValidObjectId(productId)) throw new ApiError(404, "Product not found.");
  await StockAlert.deleteOne({ product: productId, customer: user._id });
  return { subscribed: false };
}
