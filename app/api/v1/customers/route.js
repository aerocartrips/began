import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { listCustomers } from "@/lib/services/customer.service";

export const GET = withDatabase(async (request) => {
  await requireAdminAccess();
  const { searchParams } = new URL(request.url);
  const result = await listCustomers(searchParams);
  return successResponse(result.items, "Customers fetched successfully.", result.meta);
});
