import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { deleteProductType, getProductType, updateProductType } from "@/lib/services/product-type.service";

export const GET = withDatabase(async (_request, context) => {
  await requireAdminAccess(PERMISSIONS.CATALOG_MANAGE);
  const { typeId } = await context.params;
  return successResponse(await getProductType(typeId), "Product type fetched.");
});

export const PATCH = withDatabase(async (request, context) => {
  await requireAdminAccess(PERMISSIONS.CATALOG_MANAGE);
  const { typeId } = await context.params;
  return successResponse(await updateProductType(typeId, await parseJsonBody(request, 64 * 1024)), "Product type updated.");
});

export const DELETE = withDatabase(async (_request, context) => {
  await requireAdminAccess(PERMISSIONS.CATALOG_MANAGE);
  const { typeId } = await context.params;
  return successResponse(await deleteProductType(typeId), "Product type deleted.");
});
