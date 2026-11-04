import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { getFeedPage } from "@/lib/catalog/home";

/** Next page of the home page product feed (keyset cursor from the previous page). */
export const GET = withDatabase(async (request, { tenant }) => {
  const params = new URL(request.url).searchParams;
  const category = (params.get("category") ?? "").trim().toLowerCase().slice(0, 90);
  const cursor = (params.get("cursor") ?? "").slice(0, 200) || null;
  return successResponse(await getFeedPage(tenant.id, tenant.salesMode, category, cursor), "Products fetched.");
});
