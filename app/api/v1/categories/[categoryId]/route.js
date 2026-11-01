import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminUser } from "@/lib/auth/admin-access";
import {
  deleteCategory,
  getCategoryById,
  updateCategory,
} from "@/lib/services/category.service";

export const GET = withDatabase(async (_request, context) => {
  const { categoryId } = await context.params;
  const category = await getCategoryById(categoryId);
  return successResponse(category, "Category fetched successfully.");
});

export const PATCH = withDatabase(async (request, context) => {
  await requireAdminUser();
  const { categoryId } = await context.params;
  const payload = await parseJsonBody(request);
  const category = await updateCategory(categoryId, payload);
  return successResponse(category, "Category updated successfully.");
});

export const DELETE = withDatabase(async (_request, context) => {
  await requireAdminUser();
  const { categoryId } = await context.params;
  const category = await deleteCategory(categoryId);
  return successResponse(category, "Category deactivated successfully.");
});
