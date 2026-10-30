import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireImageAdmin } from "@/lib/middleware/admin-api";
import { checkRateLimit, getClientIp, recordRateLimitHit } from "@/lib/middleware/rate-limit";
import { extractUploadFiles } from "@/lib/validators/upload.validator";
import { uploadImagesFromRequest } from "@/lib/services/upload.service";
import { ApiError } from "@/lib/utils/api-error";

export const POST = withDatabase(async (request) => {
  await requireImageAdmin();

  const ip = getClientIp(request);
  const limit = checkRateLimit(`upload:${ip}`);
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
  const filenamePrefix = formData.get("filenamePrefix");

  const result = await uploadImagesFromRequest(extracted.files, {
    folder: typeof folder === "string" ? folder : undefined,
    fabric: typeof fabric === "string" ? fabric : undefined,
    filenamePrefix: typeof filenamePrefix === "string" ? filenamePrefix : undefined,
  });

  recordRateLimitHit(`upload:${ip}`);

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
