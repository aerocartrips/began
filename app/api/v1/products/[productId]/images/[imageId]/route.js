import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireImageAdmin } from "@/lib/middleware/admin-api";
import { deleteAttachedProductImage } from "@/lib/services/upload.service";

export const DELETE = withDatabase(async (_request, context) => {
  await requireImageAdmin();
  const { productId, imageId } = await context.params;
  const product = await deleteAttachedProductImage(productId, imageId);
  return successResponse(product, "Product image deleted successfully.");
});
