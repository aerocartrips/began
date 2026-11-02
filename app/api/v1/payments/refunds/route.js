import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { createAdminRefund } from "@/lib/services/refund.service";

export const POST = withDatabase(async (request) => {
  const { user: adminUser } = await requireAdminAccess(PERMISSIONS.PAYMENTS_REFUND);
  const payload = await parseJsonBody(request);
  const result = await createAdminRefund(adminUser, payload);
  return successResponse(result, "Refund initiated successfully.", undefined, 201);
});
