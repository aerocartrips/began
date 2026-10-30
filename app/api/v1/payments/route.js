import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireFinanceAdmin } from "@/lib/middleware/admin-api";
import { listPayments } from "@/lib/services/payment.service";

export const GET = withDatabase(async (request) => {
  await requireFinanceAdmin();
  const { searchParams } = new URL(request.url);
  const result = await listPayments(searchParams);
  return successResponse(result.items, "Payments fetched successfully.", result.meta);
});
