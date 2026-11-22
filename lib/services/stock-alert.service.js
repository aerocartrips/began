import mongoose from "mongoose";
import { listedProductFilter } from "@/lib/constants/product-status";
import { Product } from "@/lib/db/models/Product";
import { StockAlert } from "@/lib/db/models/StockAlert";
import { ApiError } from "@/lib/utils/api-error";

/**
 * Back-in-stock alerts. A shopper can ask about the product as a whole or
 * about one variant (the size or colour they want), which is what matters
 * when other variants are still in stock.
 */

/**
 * @param {string} productId
 * @param {string | null | undefined} variantId
 */
function alertKey(productId, variantId) {
  if (!mongoose.isValidObjectId(productId)) throw new ApiError(404, "Product not found.");
  if (variantId && !mongoose.isValidObjectId(variantId)) throw new ApiError(404, "Variant not found.");
  return { product: new mongoose.Types.ObjectId(productId), variantId: variantId ? new mongoose.Types.ObjectId(variantId) : null };
}

/**
 * @param {{ _id: unknown }} user
 * @param {string} productId
 * @param {string | null} [variantId]
 */
export async function getStockAlert(user, productId, variantId = null) {
  const key = alertKey(productId, variantId);
  const alert = await StockAlert.exists({ ...key, customer: user._id, notifiedAt: null });
  return { subscribed: Boolean(alert) };
}

/**
 * Explicit opt-in. Re-subscribing after an alert fired re-arms it. Refused
 * while what was asked about can already be ordered.
 * @param {{ _id: unknown }} user
 * @param {string} productId
 * @param {string | null} [variantId]
 */
export async function subscribeStockAlert(user, productId, variantId = null) {
  const key = alertKey(productId, variantId);
  const product = await Product.findOne({ _id: key.product, ...listedProductFilter() })
    .select("_id stockQuantity minimumOrderQuantity variants._id variants.stockQuantity")
    .lean();
  if (!product) throw new ApiError(404, "Product not found.");
  const minimum = product.minimumOrderQuantity ?? 1;

  if (key.variantId) {
    const variant = product.variants?.find((entry) => String(entry._id) === String(key.variantId));
    if (!variant) throw new ApiError(404, "Variant not found.");
    if (variant.stockQuantity >= minimum) throw new ApiError(409, "This option is already available to order.");
  } else if (product.stockQuantity >= minimum) {
    throw new ApiError(409, "This product is already available to order.");
  }

  await StockAlert.updateOne(
    { ...key, customer: user._id },
    { $set: { notifiedAt: null }, $setOnInsert: { ...key, customer: user._id } },
    { upsert: true },
  );
  return { subscribed: true };
}

/**
 * @param {{ _id: unknown }} user
 * @param {string} productId
 * @param {string | null} [variantId]
 */
export async function unsubscribeStockAlert(user, productId, variantId = null) {
  const key = alertKey(productId, variantId);
  await StockAlert.deleteOne({ ...key, customer: user._id });
  return { subscribed: false };
}
