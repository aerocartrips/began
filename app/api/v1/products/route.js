import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireCommerceAdmin } from "@/lib/middleware/admin-api";
import {
  createProduct,
  listProducts,
} from "@/lib/services/product.service";

export const GET = withDatabase(async (request) => {
  const { searchParams } = new URL(request.url);
  const result = await listProducts(searchParams);
  return successResponse(result.items, "Products fetched successfully.", result.meta);
});

export const POST = withDatabase(async (request) => {
  await requireCommerceAdmin();
  const payload = await parseJsonBody(request, 64 * 1024);
  const product = await createProduct(payload);
  return successResponse(product, "Product created successfully.", undefined, 201);
});
