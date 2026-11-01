import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import {
  getServiceRequestById,
  updateServiceRequest,
} from "@/lib/services/service-request.service";

export const GET = withDatabase(async (_request, context) => {
  await requireAdminAccess();
  const { requestId } = await context.params;
  const doc = await getServiceRequestById(requestId);
  return successResponse(doc, "Service request fetched.");
});

export const PATCH = withDatabase(async (request, context) => {
  const admin = await requireAdminAccess();
  const { requestId } = await context.params;
  const payload = await parseJsonBody(request);
  const doc = await updateServiceRequest(requestId, admin, payload);
  return successResponse(doc, "Service request updated.");
});
