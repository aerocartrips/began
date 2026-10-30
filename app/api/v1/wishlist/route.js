import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/middleware/auth";
import {
  addWishlistProduct,
  getWishlist,
  removeWishlistProduct,
} from "@/lib/services/wishlist.service";

export const GET = withDatabase(async () => {
  const user = await requireAuthUser();
  const wishlist = await getWishlist(user._id);
  return successResponse(wishlist, "Wishlist fetched successfully.");
});

export const POST = withDatabase(async (request) => {
  const user = await requireAuthUser();
  const payload = await parseJsonBody(request);
  const wishlist = await addWishlistProduct(user._id, payload.productId);
  return successResponse(wishlist, "Product added to wishlist.", undefined, 201);
});

export const DELETE = withDatabase(async (request) => {
  const user = await requireAuthUser();
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");
  if (!productId) {
    const { ApiError } = await import("@/lib/utils/api-error");
    throw new ApiError(400, "productId query parameter is required.");
  }
  const wishlist = await removeWishlistProduct(user._id, productId);
  return successResponse(wishlist, "Product removed from wishlist.");
});
