import { z } from "zod";
import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { ApiError } from "@/lib/utils/api-error";
import { requireAuthUser } from "@/lib/auth/session";
import {
  addWishlistProduct,
  getWishlistIds,
  mergeWishlist,
  removeWishlistProduct,
} from "@/lib/services/wishlist.service";

export const GET = withDatabase(async () => {
  const user = await requireAuthUser();
  return successResponse({ productIds: await getWishlistIds(user._id) }, "Wishlist fetched.");
});

export const POST = withDatabase(async (request) => {
  const user = await requireAuthUser();
  const { productId } = await parseJsonBody(request);
  return successResponse({ productIds: await addWishlistProduct(user._id, productId) }, "Added to wishlist.", undefined, 201);
});

const mergeSchema = z.object({ productIds: z.array(z.string()).max(200) });

/** Merge a signed-out wishlist into the account; returns the combined ids. */
export const PUT = withDatabase(async (request) => {
  const user = await requireAuthUser();
  const parsed = mergeSchema.safeParse(await parseJsonBody(request));
  if (!parsed.success) throw new ApiError(422, "Invalid wishlist.");
  return successResponse({ productIds: await mergeWishlist(user._id, parsed.data.productIds) }, "Wishlist merged.");
});

export const DELETE = withDatabase(async (request) => {
  const user = await requireAuthUser();
  const productId = new URL(request.url).searchParams.get("productId");
  if (!productId) throw new ApiError(400, "productId query parameter is required.");
  return successResponse({ productIds: await removeWishlistProduct(user._id, productId) }, "Removed from wishlist.");
});
