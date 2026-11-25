import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { getFeedPage } from "@/lib/catalog/home";
import { MAX_MIX_CURSOR_LENGTH } from "@/lib/catalog/cursor";

const slugParam = (params, name) => (params.get(name) ?? "").trim().toLowerCase().slice(0, 90);

/**
 * Next page of the home page product feed (keyset cursor from the previous
 * page), optionally within one category or one product type (?type=t-shirts).
 */
export const GET = withDatabase(async (request, { tenant }) => {
  const params = new URL(request.url).searchParams;
  const scope = { category: slugParam(params, "category"), type: slugParam(params, "type") };
  const cursor = (params.get("cursor") ?? "").slice(0, MAX_MIX_CURSOR_LENGTH) || null;
  return successResponse(await getFeedPage(tenant.id, tenant.salesMode, scope, cursor), "Products fetched.");
});
