import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { deleteAttribute, updateAttribute } from "@/lib/services/attribute.service";

export const PATCH = withDatabase(async (request, context) => {
  await requireAdminAccess(PERMISSIONS.CATALOG_MANAGE);
  const { attributeId } = await context.params;
  return successResponse(await updateAttribute(attributeId, await parseJsonBody(request)), "Attribute updated.");
});

export const DELETE = withDatabase(async (_request, context) => {
  await requireAdminAccess(PERMISSIONS.CATALOG_MANAGE);
  const { attributeId } = await context.params;
  return successResponse(await deleteAttribute(attributeId), "Attribute deleted.");
});
