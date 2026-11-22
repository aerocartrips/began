import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { addAttributeValue } from "@/lib/services/attribute.service";

/** Adds one value to an attribute's list (from the product form); an existing value is returned as it is. */
export const POST = withDatabase(async (request, context) => {
  await requireAdminAccess(PERMISSIONS.CATALOG_MANAGE);
  const { attributeId } = await context.params;
  const { value } = await addAttributeValue(attributeId, await parseJsonBody(request));
  return successResponse({ label: value.label, hex: value.hex ?? "", isActive: value.isActive }, "Value added.", undefined, 201);
});
