/**
 * Search and share images derived from store photos. Cloudinary delivery URLs
 * get a transformation appended to their chain, so the CDN produces each size
 * (the Next server does no image work). Other URLs are used as they are.
 */

const CLOUDINARY_UPLOAD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;
/** Transformation parameters that can start a URL segment (c_fill, w_600, ar_4:5, f_auto, …). */
const TRANSFORMATION_KEYS = new Set(["a", "ar", "b", "bo", "c", "co", "dpr", "e", "f", "fl", "g", "h", "l", "o", "q", "r", "t", "u", "w", "x", "y", "z"]);

const isTransformationSegment = (segment) =>
  segment.split(",").every((part) => {
    const match = /^([a-z]{1,3})_./.exec(part);
    return Boolean(match && TRANSFORMATION_KEYS.has(match[1]));
  });

/**
 * `url` with `transformation` applied after any transformations it already
 * has (they run in order), or null when it isn't a Cloudinary upload URL.
 * @param {string | null | undefined} url
 * @param {string} transformation e.g. "c_pad,w_1200,h_630"
 */
export function cloudinaryTransform(url, transformation) {
  const match = CLOUDINARY_UPLOAD.exec(url ?? "");
  if (!match) return null;
  const segments = match[2].split("/");
  let index = 0;
  while (index < segments.length - 1 && isTransformationSegment(segments[index])) index += 1;
  return `${match[1]}${[...segments.slice(0, index), transformation, ...segments.slice(index)].join("/")}`;
}

/** Open Graph / X card size: 1.91:1, the size Facebook, LinkedIn, X and WhatsApp render best. */
export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 };

/**
 * Share card for a photo: padded (never cropped) to 1200×630, so a portrait
 * saree photo shows whole, on a background matched to the photo's edges.
 * JPEG, which every link-preview crawler reads.
 * @param {string} url
 * @param {string} [alt]
 * @returns {{ url: string, alt?: string, width?: number, height?: number }}
 */
export function shareImage(url, alt) {
  const card = cloudinaryTransform(url, `c_pad,w_${SHARE_IMAGE_SIZE.width},h_${SHARE_IMAGE_SIZE.height},b_auto,f_jpg,q_auto`);
  return card ? { url: card, ...SHARE_IMAGE_SIZE, ...(alt ? { alt } : {}) } : { url, ...(alt ? { alt } : {}) };
}

/**
 * The 1:1, 4:3 and 16:9 versions Google recommends for structured-data images
 * (padded, so the whole product stays visible), or the photo itself when it
 * can't be resized.
 * @param {string} url
 */
export function structuredDataImages(url) {
  const sizes = [
    [1200, 1200],
    [1200, 900],
    [1200, 675],
  ];
  const variants = sizes.map(([width, height]) => cloudinaryTransform(url, `c_pad,w_${width},h_${height},b_auto,f_jpg,q_auto`));
  return variants.every(Boolean) ? /** @type {string[]} */ (variants) : [url];
}

/**
 * A square PNG of `size` pixels for favicons (Google shows only square ones),
 * padded on white rather than cropped. Null for non-Cloudinary URLs.
 * @param {string} url
 * @param {number} size
 */
export function squareIcon(url, size) {
  return cloudinaryTransform(url, `c_pad,w_${size},h_${size},b_white,f_png`);
}
