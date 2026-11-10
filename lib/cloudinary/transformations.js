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
 * The width-free part of each preset, for responsive delivery: the loader adds
 * each srcset width. `lfill` crops like `fill` but never upscales. Product card
 * photos are 4:5, the card's photo box (app/catalog.css).
 * @type {Record<TransformationPreset, string>}
 */
const RESPONSIVE_CROPS = {
  thumbnail: "c_lfill,ar_3:4",
  productCard: "c_lfill,ar_4:5",
  productDetail: "c_limit",
  highResolution: "c_limit",
};

/** @param {string} crop */
function loaderFor(crop) {
  /** @param {{ src: string, width: number, quality?: number }} params `src` is the public id */
  return ({ src, width, quality }) => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
    const normalizedId = src.replace(/^\/+/, "");
    return `https://res.cloudinary.com/${cloudName}/image/upload/${crop},w_${width},f_auto,q_${quality ?? "auto"}/${normalizedId}`;
  };
}

/**
 * `next/image` loaders for Cloudinary public ids, one per preset: Cloudinary's
 * CDN produces each srcset width, so the Next server does no image work. Only
 * use them when NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is set.
 */
export const CLOUDINARY_LOADERS = /** @type {Record<TransformationPreset, ReturnType<typeof loaderFor>>} */ (
  Object.fromEntries(Object.entries(RESPONSIVE_CROPS).map(([preset, crop]) => [preset, loaderFor(crop)]))
);

/** Full photo, never upscaled (product gallery zoom layer). */
export const cloudinaryImageLoader = CLOUDINARY_LOADERS.highResolution;

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
