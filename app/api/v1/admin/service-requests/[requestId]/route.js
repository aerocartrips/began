import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess, requireAdminUser } from "@/lib/auth/admin-access";
import {
  getServiceRequestById,
  updateServiceRequest,
} from "@/lib/services/service-request.service";

export const GET = withDatabase(async (_request, context) => {
  await requireAdminAccess(PERMISSIONS.RETURNS_MANAGE);
  const { requestId } = await context.params;
  const doc = await getServiceRequestById(requestId);
  return successResponse(doc, "Service request fetched.");
});

export const PATCH = withDatabase(async (request, context) => {
  const admin = await requireAdminUser(PERMISSIONS.RETURNS_MANAGE);
  const { requestId } = await context.params;
  const payload = await parseJsonBody(request);
  const doc = await updateServiceRequest(requestId, admin, payload);
  return successResponse(doc, "Service request updated.");
});
