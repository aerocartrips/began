import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { listPayments } from "@/lib/services/payment.service";

export const GET = withDatabase(async (request) => {
  await requireAdminAccess();
  const { searchParams } = new URL(request.url);
  const result = await listPayments(searchParams);
  return successResponse(result.items, "Payments fetched successfully.", result.meta);
});
