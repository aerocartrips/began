import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import {
  deleteProduct,
  getProduct,
  updateProduct,
} from "@/lib/services/product.service";

export const GET = withDatabase(async (_request, context) => {
  const { productId } = await context.params;
  const product = await getProduct(productId);
  return successResponse(product, "Product fetched successfully.");
});

export const PATCH = withDatabase(async (request, context) => {
  await requireAdminAccess();
  const { productId } = await context.params;
  const payload = await parseJsonBody(request, 64 * 1024);
  const product = await updateProduct(productId, payload);
  return successResponse(product, "Product updated successfully.");
});

export const DELETE = withDatabase(async (_request, context) => {
  await requireAdminAccess();
  const { productId } = await context.params;
  const product = await deleteProduct(productId);
  return successResponse(product, "Product deactivated successfully.");
});
