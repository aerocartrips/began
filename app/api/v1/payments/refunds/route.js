import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireFinanceAdmin } from "@/lib/middleware/admin-api";
import { createAdminRefund } from "@/lib/services/refund.service";
import { ApiError } from "@/lib/utils/api-error";

export const POST = withDatabase(async (request) => {
  const adminAccess = await requireFinanceAdmin();
  const adminUser =
    adminAccess.source === "api"
      ? adminAccess.user
      : { _id: undefined, email: adminAccess.session.email };
  if (!adminUser) throw new ApiError(401, "Admin access required.");
  const payload = await parseJsonBody(request);
  const result = await createAdminRefund(adminUser, payload);
  return successResponse(result, "Refund initiated successfully.", undefined, 201);
});
