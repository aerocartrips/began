import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { getClientIp } from "@/lib/security/client-ip";
import { checkRateLimit, recordRateLimitHit } from "@/lib/security/rate-limit";
import { extractUploadFiles } from "@/lib/validators/upload.validator";
import { uploadImagesFromRequest } from "@/lib/services/upload.service";
import { ApiError } from "@/lib/utils/api-error";

/**
 * Per staff account: a product with colour photos takes one request per
 * colour, so cataloguing a few dozen products must fit in a window. Still
 * bounds Cloudinary use if an account is misused (8 files per request).
 */
const UPLOAD_RATE_LIMIT = { limit: 120, windowMs: 15 * 60 * 1000 };

export const POST = withDatabase(async (request) => {
  const access = await requireAdminAccess(PERMISSIONS.CATALOG_MANAGE);

  const key = `upload:${access.user?._id ?? getClientIp(request)}`;
  const limit = await checkRateLimit(key, UPLOAD_RATE_LIMIT);
  if (!limit.allowed) {
    throw new ApiError(429, "Too many upload attempts. Please wait before trying again.");
  }

  const formData = await request.formData();
  const extracted = extractUploadFiles(formData);
  if (!extracted.ok) {
    throw new ApiError(422, "Validation failed.", [{ field: "files", message: extracted.message }]);
  }

  const folder = formData.get("folder");
  const fabric = formData.get("fabric");
  const productType = formData.get("productType");
  const filenamePrefix = formData.get("filenamePrefix");

  const result = await uploadImagesFromRequest(extracted.files, {
    folder: typeof folder === "string" ? folder : undefined,
    fabric: typeof fabric === "string" ? fabric : undefined,
    productType: typeof productType === "string" ? productType : undefined,
    filenamePrefix: typeof filenamePrefix === "string" ? filenamePrefix : undefined,
  });

  await recordRateLimitHit(key, UPLOAD_RATE_LIMIT);

  return successResponse(
    {
      images: result.images,
      failures: result.failures?.length ? result.failures : undefined,
    },
    result.failures?.length
      ? "Some images uploaded successfully."
      : "Images uploaded successfully.",
    undefined,
    201,
  );
});
