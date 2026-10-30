import { getCloudinary } from "@/lib/cloudinary/config";
import { isManagedCloudinaryPublicId } from "@/lib/constants/cloudinary-folders";
import { ApiError } from "@/lib/utils/api-error";

/**
 * @param {string} publicId
 */
export function assertDeletablePublicId(publicId) {
  if (!isManagedCloudinaryPublicId(publicId)) {
    throw new ApiError(403, "This Cloudinary asset cannot be deleted.");
  }
}

/**
 * @param {string} publicId
 */
export async function deleteCloudinaryImage(publicId) {
  assertDeletablePublicId(publicId);
  const cloudinary = getCloudinary();

  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
    if (result.result === "not found") {
      return { deleted: false, reason: "not_found" };
    }
    return { deleted: result.result === "ok", reason: result.result };
  } catch {
    throw new ApiError(502, "Cloudinary could not delete the image.");
  }
}

/**
 * @param {string[]} publicIds
 */
export async function deleteCloudinaryImages(publicIds) {
  const results = [];
  for (const publicId of publicIds) {
    assertDeletablePublicId(publicId);
    const outcome = await deleteCloudinaryImage(publicId);
    results.push({ publicId, ...outcome });
  }
  return results;
}
