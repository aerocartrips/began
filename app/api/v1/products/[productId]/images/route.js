import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { extractUploadFiles } from "@/lib/validators/upload.validator";
import {
  attachProductImages,
  updateAttachedProductImages,
} from "@/lib/services/upload.service";
import { ApiError } from "@/lib/utils/api-error";

export const POST = withDatabase(async (request, context) => {
  await requireAdminAccess(PERMISSIONS.CATALOG_MANAGE);
  const { productId } = await context.params;
  const formData = await request.formData();
  const extracted = extractUploadFiles(formData);
  if (!extracted.ok) {
    throw new ApiError(422, "Validation failed.", [{ field: "files", message: extracted.message }]);
  }

  const folder = formData.get("folder");
  const fabric = formData.get("fabric");
  const result = await attachProductImages(productId, extracted.files, {
    folder: typeof folder === "string" ? folder : undefined,
    fabric: typeof fabric === "string" ? fabric : undefined,
  });

  return successResponse(
    {
      product: result.product,
      uploaded: result.uploaded,
      failures: result.failures?.length ? result.failures : undefined,
    },
    "Product images uploaded successfully.",
    undefined,
    201,
  );
});

export const PATCH = withDatabase(async (request, context) => {
  await requireAdminAccess(PERMISSIONS.CATALOG_MANAGE);
  const { productId } = await context.params;
  const payload = await parseJsonBody(request);
  const product = await updateAttachedProductImages(productId, payload);
  return successResponse(product, "Product images updated successfully.");
});
