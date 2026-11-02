import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { createStaff, listStaff } from "@/lib/services/staff.service";

export const GET = withDatabase(async () => {
  await requireAdminAccess(PERMISSIONS.STAFF_MANAGE);
  return successResponse(await listStaff(), "Staff fetched.");
});

export const POST = withDatabase(async (request) => {
  await requireAdminAccess(PERMISSIONS.STAFF_MANAGE);
  return successResponse(await createStaff(await parseJsonBody(request)), "Staff account created.", undefined, 201);
});
