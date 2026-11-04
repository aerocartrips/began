import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { getAuthUser } from "@/lib/auth/session";
import { getRecommendations } from "@/lib/catalog/recommendations";

const ids = (params, key) => (params.get(key) ?? "").split(",").filter(Boolean).slice(0, 20);

/**
 * "Picked for you". The browser sends the product ids it already holds
 * (recently viewed, wishlist, cart); a signed-in shopper's account wishlist
 * and orders are added on the server. Responses are private to the shopper.
 */
export const GET = withDatabase(async (request, { tenant }) => {
  const params = new URL(request.url).searchParams;
  const user = await getAuthUser();
  const limit = Math.min(Math.max(Number.parseInt(params.get("limit") ?? "10", 10) || 10, 4), 24);
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
