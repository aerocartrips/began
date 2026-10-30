import { buildDeliveryUrl } from "@/lib/cloudinary/transformations";
import { getCloudName } from "@/lib/cloudinary/config";

/**
 * @param {Record<string, any>} doc
 */
export function mapMongoImageToStorefront(image, index, productName) {
  const cloudName = getCloudName();
  const secureUrl = image.secureUrl || image.url;
  const publicId = image.publicId || "";
  const src =
    publicId && cloudName
      ? buildDeliveryUrl(publicId, index === 0 ? "productDetail" : "productCard", cloudName)
      : secureUrl;

  return {
    src: src || secureUrl,
    alt: image.alt || productName,
    publicId,
    secureUrl,
  };
}
