import { randomUUID } from "node:crypto";
import { getCloudinary } from "@/lib/cloudinary/config";
import { mapUploadResult } from "@/lib/cloudinary/transformations";
import { ApiError } from "@/lib/utils/api-error";
import { storeFolder } from "@/lib/constants/cloudinary-folders";

/**
 * @param {File} file
 * @param {{ folder: string, filename?: string, tags?: string[] }} options
 */
export async function uploadImageFile(file, options) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const cloudinary = getCloudinary();
  const publicId = options.filename || `asset-${randomUUID()}`;

  try {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: storeFolder(options.folder),
          public_id: publicId,
          overwrite: false,
          unique_filename: true,
          resource_type: "image",
          tags: options.tags,
        },
        (error, uploadResult) => {
          if (error || !uploadResult) {
            reject(error ?? new Error("Upload failed."));
            return;
          }
          resolve(uploadResult);
        },
      );
      stream.end(buffer);
    });

    return mapUploadResult(result);
  } catch {
    throw new ApiError(502, "Cloudinary rejected the image upload.");
  }
}

/**
 * @param {File[]} files
 * @param {{ folder: string, filenamePrefix?: string, tags?: string[] }} options
 */
export async function uploadMultipleImageFiles(files, options) {
  /** @type {Awaited<ReturnType<typeof uploadImageFile>>[]} */
  const uploaded = [];
  /** @type {{ filename: string, message: string }[]} */
  const failures = [];

  for (const [index, file] of files.entries()) {
    try {
      const result = await uploadImageFile(file, {
        folder: storeFolder(options.folder),
        filename: options.filenamePrefix ? `${options.filenamePrefix}-${index + 1}` : undefined,
        tags: options.tags,
      });
      uploaded.push(result);
    } catch (error) {
      failures.push({
        filename: file.name,
        message: error instanceof ApiError ? error.message : "Upload failed.",
      });
    }
  }

  return { uploaded, failures };
}
