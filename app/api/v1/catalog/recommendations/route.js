import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { getAuthUser } from "@/lib/auth/session";
import { getRecommendations } from "@/lib/catalog/recommendations";
import { DEFAULT_SECTION_PRODUCTS, MAX_SECTION_PRODUCTS } from "@/lib/constants/homepage";

const ids = (params, key) => (params.get(key) ?? "").split(",").filter(Boolean).slice(0, 20);

/**
 * "Picked for you". The browser sends the product ids it already holds
 * (recently viewed, wishlist, cart); a signed-in shopper's account wishlist
 * and orders are added on the server. Responses are private to the shopper.
 */
export const GET = withDatabase(async (request, { tenant }) => {
  const params = new URL(request.url).searchParams;
  const user = await getAuthUser();
  const requested = Number.parseInt(params.get("limit") ?? "", 10) || DEFAULT_SECTION_PRODUCTS;
  const limit = Math.min(Math.max(requested, 4), MAX_SECTION_PRODUCTS);
  const result = await getRecommendations(tenant.id, tenant.salesMode, {
    viewedIds: ids(params, "viewed"),
    wishlistIds: ids(params, "wished"),
    cartIds: ids(params, "cart"),
    userId: user?._id ?? null,
    limit,
  });
  const response = successResponse(result, "Recommendations fetched.");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
});
