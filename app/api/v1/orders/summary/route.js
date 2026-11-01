import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { getAuthUser, requireAuthUser } from "@/lib/auth/session";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { getOrderSummary } from "@/lib/services/order.service";

export const GET = withDatabase(async () => {
  const user = await getAuthUser();
  if (user) {
    const summary = await getOrderSummary(user, false);
    return successResponse(summary, "Order summary fetched successfully.");
  }

  await requireAdminAccess();
  const summary = await getOrderSummary(null, true);
  return successResponse(summary, "Order summary fetched successfully.");
});
