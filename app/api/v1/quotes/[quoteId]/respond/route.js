import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/auth/session";
import { respondToQuote } from "@/lib/services/quote.service";

/** Accept or decline a priced quote. */
export const POST = withDatabase(async (request, context) => {
  const user = await requireAuthUser();
  const { quoteId } = await context.params;
  return successResponse(await respondToQuote(user, quoteId, await parseJsonBody(request)), "Response recorded.");
});
