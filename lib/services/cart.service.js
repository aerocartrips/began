import mongoose from "mongoose";
import { ApiError } from "@/lib/utils/api-error";
import { Cart } from "@/lib/db/models/Cart";
import { Product } from "@/lib/db/models/Product";
import { PRODUCT_STATUS } from "@/lib/constants/product-status";

async function getOrCreateCart(userId) {
  let cart = await Cart.findOne({ user: userId }).populate("items.product");
  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
    cart = await Cart.findById(cart._id).populate("items.product");
  }
  return cart;
}

export async function getCart(userId) {
  return getOrCreateCart(userId);
}

export async function upsertCartItem(userId, payload) {
  const { productId, quantity, selectedAttributes = {} } = payload;
  if (!mongoose.isValidObjectId(productId)) {
    throw new ApiError(422, "Validation failed.", [
      { field: "productId", message: "Invalid product id." },
    ]);
  }

  const product = await Product.findById(productId);
  if (!product || product.status !== PRODUCT_STATUS.ACTIVE) {
    throw new ApiError(404, "Product not available.");
  }

  const cart = await getOrCreateCart(userId);
  const existing = cart.items.find((item) => String(item.product._id ?? item.product) === productId);
  if (existing) {
    existing.quantity = quantity;
    existing.selectedAttributes = selectedAttributes;
  } else {
    cart.items.push({ product: productId, quantity, selectedAttributes });
  }

  await cart.save();
  return Cart.findById(cart._id).populate("items.product");
}

export async function removeCartItem(userId, productId) {
  if (!mongoose.isValidObjectId(productId)) {
    throw new ApiError(422, "Validation failed.", [
      { field: "productId", message: "Invalid product id." },
    ]);
  }
  const cart = await getOrCreateCart(userId);
  cart.items = cart.items.filter((item) => String(item.product._id ?? item.product) !== productId);
  await cart.save();
  return Cart.findById(cart._id).populate("items.product");
}

export async function clearCart(userId) {
  const cart = await getOrCreateCart(userId);
  cart.items = [];
  await cart.save();
  return cart;
}
