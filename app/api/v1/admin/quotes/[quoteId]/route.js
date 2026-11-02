import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { getQuoteForAdmin, updateQuoteAsAdmin } from "@/lib/services/quote.service";

export const GET = withDatabase(async (_request, context) => {
  await requireAdminAccess(PERMISSIONS.QUOTES_MANAGE);
  const { quoteId } = await context.params;
  return successResponse(await getQuoteForAdmin(quoteId), "Quote fetched.");
});

export const PATCH = withDatabase(async (request, context) => {
  const { user } = await requireAdminAccess(PERMISSIONS.QUOTES_MANAGE);
  const { quoteId } = await context.params;
  return successResponse(await updateQuoteAsAdmin(quoteId, user, await parseJsonBody(request)), "Quote updated.");
});
