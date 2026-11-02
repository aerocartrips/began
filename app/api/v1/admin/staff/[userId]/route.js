import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { updateStaff } from "@/lib/services/staff.service";

export const PATCH = withDatabase(async (request, context) => {
  const { user } = await requireAdminAccess(PERMISSIONS.STAFF_MANAGE);
  const { userId } = await context.params;
  return successResponse(await updateStaff(user, userId, await parseJsonBody(request)), "Staff updated.");
});
