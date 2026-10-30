import { z } from "zod";

export const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_REQUEST = 8;

export const uploadFolderSchema = z.string().trim().max(120).optional();

export const productImageSchema = z.object({
  publicId: z.string().trim().min(3).max(260),
  url: z.string().url().max(2048),
  secureUrl: z.string().url().max(2048),
  alt: z.string().trim().max(160).default(""),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  format: z.string().trim().max(12).optional(),
  bytes: z.number().int().nonnegative().optional(),
  isPrimary: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

export const updateProductImagesSchema = z.object({
  images: z.array(
    z.object({
      _id: z.string().trim().optional(),
      publicId: z.string().trim().min(3).max(260).optional(),
      url: z.string().url().max(2048).optional(),
      secureUrl: z.string().url().max(2048).optional(),
      alt: z.string().trim().max(160).optional(),
      isPrimary: z.boolean().optional(),
      sortOrder: z.number().int().min(0).max(1000).optional(),
    }),
  ).min(1).max(20),
});

/**
 * @param {File} file
 */
export function validateUploadFile(file) {
  if (!(file instanceof File)) {
    return { ok: false, message: "Expected a file upload." };
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return { ok: false, message: `${file.name} has an unsupported file type.` };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, message: `${file.name} exceeds the 10 MB limit.` };
  }
  return { ok: true };
}

/**
 * @param {FormData} formData
 */
export function extractUploadFiles(formData) {
  const fromArray = formData.getAll("files").filter((entry) => entry instanceof File);
  const single = formData.get("file");
  const files = fromArray.length > 0 ? fromArray : single instanceof File ? [single] : [];

  if (files.length === 0) {
    return { ok: false, message: "At least one image file is required.", files: [] };
  }
  if (files.length > MAX_FILES_PER_REQUEST) {
    return {
      ok: false,
      message: `You can upload up to ${MAX_FILES_PER_REQUEST} images per request.`,
      files: [],
    };
  }

  for (const file of files) {
    const validation = validateUploadFile(file);
    if (!validation.ok) return { ok: false, message: validation.message, files: [] };
  }

  return { ok: true, files };
}
