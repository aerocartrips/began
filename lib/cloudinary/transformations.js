export const TRANSFORMATION_PRESETS = {
  thumbnail: "w_300,h_400,c_fill,f_auto,q_auto",
  productCard: "w_600,h_800,c_fill,f_auto,q_auto",
  productDetail: "w_1200,h_1600,c_limit,f_auto,q_auto",
  highResolution: "w_2000,h_2500,c_limit,f_auto,q_auto",
};

/** @typedef {"thumbnail"|"productCard"|"productDetail"|"highResolution"} TransformationPreset */

/**
 * @param {string} publicId
 * @param {TransformationPreset} preset
 * @param {string} cloudName
 */
export function buildDeliveryUrl(publicId, preset = "productCard", cloudName) {
  if (!publicId || !cloudName) return null;
  const transformation = TRANSFORMATION_PRESETS[preset] ?? TRANSFORMATION_PRESETS.productCard;
  const normalizedId = publicId.replace(/^\/+/, "");
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformation}/${normalizedId}`;
}

/**
 * @param {string} publicId
 * @param {TransformationPreset} preset
 */
export function buildClientDeliveryUrl(publicId, preset = "productCard") {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  if (!cloudName) return null;
  return buildDeliveryUrl(publicId, preset, cloudName);
}

/**
 * @param {Record<string, unknown>} result
 */
export function mapUploadResult(result) {
  return {
    publicId: result.public_id,
    url: result.url,
    secureUrl: result.secure_url,
    format: result.format,
    width: result.width,
    height: result.height,
    bytes: result.bytes,
    resourceType: result.resource_type,
  };
}
