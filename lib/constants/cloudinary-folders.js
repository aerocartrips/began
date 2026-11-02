import { getTenantContext } from "@/lib/tenant/context";

export const CLOUDINARY_ROOT = "norosilk";
const STORES_ROOT = `${CLOUDINARY_ROOT}/stores`;

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
 * Physical folder for a logical one in the current store:
 * "norosilk/products/silk" → "norosilk/stores/<tenantId>/products/silk".
 * @param {string} folder
 */
export function storeFolder(folder) {
  const tenantId = getTenantContext()?.tenantId;
  if (!tenantId) throw new Error("Uploads require a tenant context.");
  return `${STORES_ROOT}/${tenantId}/${folder.slice(CLOUDINARY_ROOT.length + 1)}`;
}

/**
 * Assets the current store may delete: its own folder, plus pre-multi-tenant
 * uploads (outside norosilk/stores/), which only the original store references.
 * @param {string} publicId
 */
export function isManagedCloudinaryPublicId(publicId) {
  if (typeof publicId !== "string" || !publicId.startsWith(`${CLOUDINARY_ROOT}/`)) return false;
  if (!publicId.startsWith(`${STORES_ROOT}/`)) return true;
  const tenantId = getTenantContext()?.tenantId;
  return Boolean(tenantId) && publicId.startsWith(`${STORES_ROOT}/${tenantId}/`);
}
