import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminUser } from "@/lib/auth/admin-access";
import {
  createCategory,
  deleteCategory,
  listCategories,
} from "@/lib/services/category.service";

export const GET = withDatabase(async (request) => {
  const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "true";
  const categories = await listCategories({ includeInactive });
  return successResponse(categories, "Categories fetched successfully.");
});

export const POST = withDatabase(async (request) => {
  await requireAdminUser();
  const payload = await parseJsonBody(request);
  const category = await createCategory(payload);
  return successResponse(category, "Category created successfully.", undefined, 201);
});
