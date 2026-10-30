import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { getAuthUser, requireAuthUser } from "@/lib/middleware/auth";
import { requireCommerceAdmin } from "@/lib/middleware/admin-api";
import { getOrderSummary } from "@/lib/services/order.service";

export const GET = withDatabase(async () => {
  const user = await getAuthUser();
  if (user) {
    const summary = await getOrderSummary(user, false);
    return successResponse(summary, "Order summary fetched successfully.");
  }

  await requireCommerceAdmin();
  const summary = await getOrderSummary(null, true);
  return successResponse(summary, "Order summary fetched successfully.");
});
