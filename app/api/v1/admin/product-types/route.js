import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { createProductType, createProductTypeFromTemplate, listProductTypes } from "@/lib/services/product-type.service";

/** Product types with product counts, the templates to start new ones from, and products still without a type. */
export const GET = withDatabase(async () => {
  await requireAdminAccess(PERMISSIONS.CATALOG_MANAGE);
  return successResponse(await listProductTypes(), "Product types fetched.");
});

/** `{ template: "t-shirt" }` creates a type from a template; anything else is a full type definition. */
export const POST = withDatabase(async (request) => {
  await requireAdminAccess(PERMISSIONS.CATALOG_MANAGE);
  const payload = await parseJsonBody(request, 64 * 1024);
  const type = payload && typeof payload === "object" && "template" in payload ? await createProductTypeFromTemplate(payload) : await createProductType(payload);
  return successResponse(type, "Product type created.", undefined, 201);
});
