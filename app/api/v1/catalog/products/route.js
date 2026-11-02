import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { getProductCardsByIds } from "@/lib/catalog/query";

/** Product cards for ids saved in the browser (wishlist, recently viewed). */
export const GET = withDatabase(async (request, { tenant }) => {
  const ids = (new URL(request.url).searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, 100);
  const cards = await getProductCardsByIds(tenant.id, tenant.salesMode, ids);
  return successResponse(cards, "Products fetched.");
});
