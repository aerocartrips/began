import mongoose from "mongoose";
import { deleteCloudinaryImage } from "@/lib/cloudinary/delete";
import { uploadMultipleImageFiles } from "@/lib/cloudinary/upload";
import { buildDeliveryUrl } from "@/lib/cloudinary/transformations";
import { getCloudName } from "@/lib/cloudinary/config";
import { resolveUploadFolder } from "@/lib/constants/cloudinary-folders";
import { ApiError } from "@/lib/utils/api-error";
import { formatZodErrors } from "@/lib/validators/auth.validator";
import {
  productImageSchema,
  updateProductImagesSchema,
} from "@/lib/validators/upload.validator";
import { getProduct } from "@/lib/services/product.service";

function normalizeImageRecord(image, index) {
  const cloudName = getCloudName();
  const secureUrl = image.secureUrl || image.url;
  const publicId = image.publicId || "";
  const optimizedUrl =
    publicId && cloudName
      ? buildDeliveryUrl(publicId, "productDetail", cloudName)
      : secureUrl;

  return {
    publicId,
    url: optimizedUrl || secureUrl,
    secureUrl: secureUrl || optimizedUrl,
    alt: image.alt || "",
    width: image.width,
    height: image.height,
    format: image.format,
    bytes: image.bytes,
    isPrimary: image.isPrimary ?? index === 0,
    sortOrder: image.sortOrder ?? index,
  };
}

function applyPrimarySelection(images) {
  const primaryIndex = images.findIndex((image) => image.isPrimary);
  const resolvedPrimary = primaryIndex >= 0 ? primaryIndex : 0;
  return images.map((image, index) => ({
    ...image,
    isPrimary: index === resolvedPrimary,
    sortOrder: image.sortOrder ?? index,
  }));
}

export async function uploadStandaloneImages(files, { folder, fabric, filenamePrefix } = {}) {
  const resolvedFolder = resolveUploadFolder(fabric, folder);
  if (!resolvedFolder) {
    throw new ApiError(422, "Validation failed.", [
      { field: "folder", message: "Invalid Cloudinary folder." },
    ]);
  }

  const { uploaded, failures } = await uploadMultipleImageFiles(files, {
    folder: resolvedFolder,
    filenamePrefix,
    tags: ["norosilk", "product"],
  });

  if (!uploaded.length) {
    throw new ApiError(502, "No images were uploaded.", failures.map((entry) => ({
      field: entry.filename,
      message: entry.message,
    })));
  }

  return {
    images: uploaded.map((image, index) =>
      normalizeImageRecord(
        {
          ...image,
          alt: "",
        },
        index,
      ),
    ),
    failures,
  };
}

export async function attachImagesToProduct(productId, files, options = {}) {
  const product = await getProduct(productId);
  const prefix = product.slug || product.sku?.toLowerCase();
  const uploadResult = await uploadStandaloneImages(files, {
    ...options,
    fabric: options.fabric || product.fabric,
    filenamePrefix: prefix,
  });

  const startIndex = product.images.length;
  const appended = uploadResult.images.map((image, offset) =>
    normalizeImageRecord(image, startIndex + offset),
  );
  product.images.push(...appended);
  if (!product.images.some((image) => image.isPrimary) && product.images.length > 0) {
    product.images[0].isPrimary = true;
  }
  await product.save();
  return { product, uploaded: appended, failures: uploadResult.failures };
}

export async function updateProductImageMetadata(productId, payload) {
  const parsed = updateProductImagesSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  }

  const product = await getProduct(productId);
  const updatesById = new Map(
    parsed.data.images
      .filter((image) => image._id)
      .map((image) => [String(image._id), image]),
  );

  product.images.forEach((image) => {
    const incoming = updatesById.get(String(image._id));
    if (!incoming) return;
    if (incoming.alt !== undefined) image.alt = incoming.alt;
    if (incoming.isPrimary !== undefined) image.isPrimary = incoming.isPrimary;
    if (incoming.sortOrder !== undefined) image.sortOrder = incoming.sortOrder;
  });

  product.images.sort((left, right) => left.sortOrder - right.sortOrder);
  const primaryIndex = product.images.findIndex((image) => image.isPrimary);
  product.images.forEach((image, index) => {
    image.isPrimary = primaryIndex >= 0 ? index === primaryIndex : index === 0;
  });

  await product.save();
  return product;
}

export async function removeProductImage(productId, imageId) {
  if (!mongoose.isValidObjectId(imageId)) {
    throw new ApiError(404, "Image not found.");
  }

  const product = await getProduct(productId);
  const target = product.images.id(imageId);
  if (!target) {
    throw new ApiError(404, "Image not found.");
  }

  const publicId = target.publicId;
  if (publicId) {
    try {
      await deleteCloudinaryImage(publicId);
    } catch (error) {
      throw new ApiError(502, "Cloudinary deletion failed. The product image was not removed.", [
        { field: "imageId", message: error instanceof ApiError ? error.message : "Delete failed." },
      ]);
    }
  }

  target.deleteOne();
  if (product.images.length > 0 && !product.images.some((image) => image.isPrimary)) {
    product.images[0].isPrimary = true;
  }
  await product.save();
  return product;
}

export function mapIncomingCloudinaryUpload(uploaded) {
  const parsed = productImageSchema.safeParse(uploaded);
  if (!parsed.success) {
    throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  }
  return normalizeImageRecord(parsed.data, 0);
}
