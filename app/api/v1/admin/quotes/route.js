import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { listQuotesForAdmin } from "@/lib/services/quote.service";

export const GET = withDatabase(async (request) => {
  await requireAdminAccess(PERMISSIONS.QUOTES_MANAGE);
  const result = await listQuotesForAdmin(new URL(request.url).searchParams);
  return successResponse(result.items, "Quotes fetched.", result.meta);
});
