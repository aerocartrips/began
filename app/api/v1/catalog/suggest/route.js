import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { suggestProducts } from "@/lib/catalog/query";

/** Search-as-you-type suggestions for the header search. */
export const GET = withDatabase(async (request, { tenant }) => {
  const term = new URL(request.url).searchParams.get("q") ?? "";
  const suggestions = await suggestProducts(tenant.id, tenant.salesMode, term);
  return successResponse(suggestions, "Suggestions fetched.");
});
