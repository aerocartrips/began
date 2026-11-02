import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { deleteAttachedProductImage } from "@/lib/services/upload.service";

export const DELETE = withDatabase(async (_request, context) => {
  await requireAdminAccess(PERMISSIONS.CATALOG_MANAGE);
  const { productId, imageId } = await context.params;
  const product = await deleteAttachedProductImage(productId, imageId);
  return successResponse(product, "Product image deleted successfully.");
});
