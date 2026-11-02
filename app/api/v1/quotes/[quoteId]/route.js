import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/auth/session";
import { getCustomerQuote } from "@/lib/services/quote.service";

export const GET = withDatabase(async (_request, context) => {
  const user = await requireAuthUser();
  const { quoteId } = await context.params;
  return successResponse(await getCustomerQuote(user, quoteId), "Quote fetched.");
});
