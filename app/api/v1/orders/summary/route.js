import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { resolveViewer } from "@/lib/auth/viewer";
import { getOrderSummary } from "@/lib/services/order.service";

export const GET = withDatabase(async () => {
  const { customer } = await resolveViewer(PERMISSIONS.DASHBOARD_VIEW);
  const summary = await getOrderSummary(customer, !customer);
  return successResponse(summary, "Order summary fetched successfully.");
});
