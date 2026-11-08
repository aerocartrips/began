import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess, requireAdminUser } from "@/lib/auth/admin-access";
import {
  createProduct,
  listProducts,
} from "@/lib/services/product.service";

export const GET = withDatabase(async (request) => {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  // Drafts and inactive products are visible to catalogue staff only.
  if (searchParams.get("admin") === "true" || (status && status !== "active") || searchParams.get("availability")) {
    await requireAdminAccess(PERMISSIONS.CATALOG_MANAGE);
  }
  const result = await listProducts(searchParams);
  return successResponse(result.items, "Products fetched successfully.", result.meta);
});

export const POST = withDatabase(async (request) => {
  const admin = await requireAdminUser(PERMISSIONS.CATALOG_MANAGE);
  const payload = await parseJsonBody(request, 64 * 1024);
  const product = await createProduct(payload, admin);
  return successResponse(product, "Product created successfully.", undefined, 201);
});
