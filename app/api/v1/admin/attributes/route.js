import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { createAttribute, listAttributes } from "@/lib/services/attribute.service";

export const GET = withDatabase(async () => {
  await requireAdminAccess(PERMISSIONS.CATALOG_MANAGE);
  return successResponse(await listAttributes(), "Attributes fetched.");
});

export const POST = withDatabase(async (request) => {
  await requireAdminAccess(PERMISSIONS.CATALOG_MANAGE);
  return successResponse(await createAttribute(await parseJsonBody(request)), "Attribute created.", undefined, 201);
});
