import { isCloudinaryConfigured } from "@/lib/cloudinary/config";
import {
  attachImagesToProduct,
  removeProductImage,
  updateProductImageMetadata,
  uploadStandaloneImages,
} from "@/lib/services/product-image.service";

export { isCloudinaryConfigured };

export async function uploadImagesFromRequest(files, options) {
  return uploadStandaloneImages(files, options);
}

export async function attachProductImages(productId, files, options) {
  return attachImagesToProduct(productId, files, options);
}

export async function updateAttachedProductImages(productId, payload) {
  return updateProductImageMetadata(productId, payload);
}

export async function deleteAttachedProductImage(productId, imageId) {
  return removeProductImage(productId, imageId);
}
