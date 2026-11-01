export const CLOUDINARY_ROOT = "norosilk";

export const CLOUDINARY_FOLDERS = {
  productsSarees: `${CLOUDINARY_ROOT}/products/sarees`,
  productsSilk: `${CLOUDINARY_ROOT}/products/silk`,
  productsCotton: `${CLOUDINARY_ROOT}/products/cotton`,
  productsHandloom: `${CLOUDINARY_ROOT}/products/handloom`,
  categories: `${CLOUDINARY_ROOT}/categories`,
  banners: `${CLOUDINARY_ROOT}/banners`,
  collections: `${CLOUDINARY_ROOT}/collections`,
  blog: `${CLOUDINARY_ROOT}/blog`,
  reviews: `${CLOUDINARY_ROOT}/reviews`,
  avatars: `${CLOUDINARY_ROOT}/avatars`,
};

/** @type {readonly string[]} */
export const ALLOWED_UPLOAD_FOLDERS = Object.values(CLOUDINARY_FOLDERS);

const FABRIC_FOLDER_RULES = [
  { pattern: /silk/i, folder: CLOUDINARY_FOLDERS.productsSilk },
  { pattern: /cotton/i, folder: CLOUDINARY_FOLDERS.productsCotton },
  { pattern: /handloom/i, folder: CLOUDINARY_FOLDERS.productsHandloom },
];

/**
 * @param {string | undefined} fabric
 * @param {string | undefined} requestedFolder
 */
export function resolveUploadFolder(fabric, requestedFolder) {
  if (requestedFolder) {
    if (!ALLOWED_UPLOAD_FOLDERS.includes(requestedFolder)) {
      return null;
    }
    return requestedFolder;
  }

  if (fabric) {
    const matched = FABRIC_FOLDER_RULES.find((rule) => rule.pattern.test(fabric));
    if (matched) return matched.folder;
  }

  return CLOUDINARY_FOLDERS.productsSarees;
}

/**
 * @param {string} publicId
 */
export function isManagedCloudinaryPublicId(publicId) {
  return typeof publicId === "string" && publicId.startsWith(`${CLOUDINARY_ROOT}/`);
}
