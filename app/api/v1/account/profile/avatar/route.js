import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/auth/session";
import { consumeRateLimit } from "@/lib/security/rate-limit-guard";
import { ACCOUNT_RATE_LIMITS } from "@/lib/constants/account";
import { ApiError } from "@/lib/utils/api-error";
import { removeAvatar, updateAvatar } from "@/lib/services/account.service";

const MAX_REQUEST_BYTES = 6 * 1024 * 1024;

export const PUT = withDatabase(async (request) => {
  const user = await requireAuthUser();
  await consumeRateLimit(`account:avatar:${user._id}`, ACCOUNT_RATE_LIMITS.avatarUpload, "Too many photo uploads. Please try again later.");
  if (Number(request.headers.get("content-length") ?? 0) > MAX_REQUEST_BYTES) {
    throw new ApiError(413, "Profile photos must be 5 MB or smaller.");
  }
  const formData = await request.formData().catch(() => {
    throw new ApiError(400, "Expected a multipart form upload.");
  });
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new ApiError(422, "Validation failed.", [{ field: "file", message: "Choose an image to upload." }]);
  }
  return successResponse(await updateAvatar(user, file), "Profile photo updated.");
});

export const DELETE = withDatabase(async () => {
  const user = await requireAuthUser();
  return successResponse(await removeAvatar(user), "Profile photo removed.");
});
