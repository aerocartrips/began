import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireCommerceAdmin } from "@/lib/middleware/admin-api";
import { getCustomerSummary } from "@/lib/services/customer.service";

export const GET = withDatabase(async () => {
  await requireCommerceAdmin();
  const summary = await getCustomerSummary();
  return successResponse(summary, "Customer summary fetched.");
});
