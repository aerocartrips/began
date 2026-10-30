import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireCommerceAdmin } from "@/lib/middleware/admin-api";
import {
  getServiceRequestSummary,
  listServiceRequests,
  migrateLegacyServiceRequestsFromOrders,
} from "@/lib/services/service-request.service";

export const GET = withDatabase(async (request) => {
  await requireCommerceAdmin();
  await migrateLegacyServiceRequestsFromOrders();
  const searchParams = new URL(request.url).searchParams;
  if (searchParams.get("summary") === "1") {
    const summary = await getServiceRequestSummary();
    return successResponse(summary, "Service request summary fetched.");
  }
  const result = await listServiceRequests(searchParams);
  return successResponse(result.items, "Service requests fetched.", result.meta);
});
