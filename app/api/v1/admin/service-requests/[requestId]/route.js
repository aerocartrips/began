import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireCommerceAdmin } from "@/lib/middleware/admin-api";
import {
  getServiceRequestById,
  updateServiceRequest,
} from "@/lib/services/service-request.service";

export const GET = withDatabase(async (_request, context) => {
  await requireCommerceAdmin();
  const { requestId } = await context.params;
  const doc = await getServiceRequestById(requestId);
  return successResponse(doc, "Service request fetched.");
});

export const PATCH = withDatabase(async (request, context) => {
  const admin = await requireCommerceAdmin();
  const { requestId } = await context.params;
  const payload = await parseJsonBody(request);
  const doc = await updateServiceRequest(requestId, admin, payload);
  return successResponse(doc, "Service request updated.");
});
