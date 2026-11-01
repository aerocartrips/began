import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { getCustomerSummary } from "@/lib/services/customer.service";

export const GET = withDatabase(async () => {
  await requireAdminAccess();
  const summary = await getCustomerSummary();
  return successResponse(summary, "Customer summary fetched.");
});
