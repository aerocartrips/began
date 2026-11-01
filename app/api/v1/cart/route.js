import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/auth/session";
import {
  clearCart,
  getCart,
  removeCartItem,
  upsertCartItem,
} from "@/lib/services/cart.service";

export const GET = withDatabase(async () => {
  const user = await requireAuthUser();
  const cart = await getCart(user._id);
  return successResponse(cart, "Cart fetched successfully.");
});

export const POST = withDatabase(async (request) => {
  const user = await requireAuthUser();
  const payload = await parseJsonBody(request);
  const cart = await upsertCartItem(user._id, payload);
  return successResponse(cart, "Cart updated successfully.", undefined, 201);
});

export const PATCH = withDatabase(async (request) => {
  const user = await requireAuthUser();
  const payload = await parseJsonBody(request);
  const cart = await upsertCartItem(user._id, payload);
  return successResponse(cart, "Cart updated successfully.");
});

export const DELETE = withDatabase(async (request) => {
  const user = await requireAuthUser();
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");
  const cart = productId ? await removeCartItem(user._id, productId) : await clearCart(user._id);
  return successResponse(cart, "Cart updated successfully.");
});
