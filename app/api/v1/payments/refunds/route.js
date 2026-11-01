import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { createAdminRefund } from "@/lib/services/refund.service";
import { ApiError } from "@/lib/utils/api-error";

export const POST = withDatabase(async (request) => {
  const adminAccess = await requireAdminAccess();
  const adminUser =
    adminAccess.source === "api"
      ? adminAccess.user
      : { _id: undefined, email: adminAccess.session.email };
  if (!adminUser) throw new ApiError(401, "Admin access required.");
  const payload = await parseJsonBody(request);
  const result = await createAdminRefund(adminUser, payload);
  return successResponse(result, "Refund initiated successfully.", undefined, 201);
});
