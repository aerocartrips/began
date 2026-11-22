export const PRODUCT_STATUS = {
  DRAFT: "draft",
  ACTIVE: "active",
  INACTIVE: "inactive",
  OUT_OF_STOCK: "out_of_stock",
};

export const PRODUCT_STATUS_VALUES = Object.values(PRODUCT_STATUS);

/**
 * Filter for products shoppers may see and buy: listed (active) and of a
 * product type the store is selling. Use it for every storefront read and
 * purchase check; admin screens see every product. A new object each call:
 * Mongoose casts filters in place, so one shared object must never be reused.
 */
export const listedProductFilter = () => ({ status: PRODUCT_STATUS.ACTIVE, typeHidden: { $ne: true } });

/**
 * Whether a product (lean or document) is listed on the storefront.
 * @param {{ status?: string, typeHidden?: boolean } | null | undefined} product
 */
export function isListedProduct(product) {
  return product?.status === PRODUCT_STATUS.ACTIVE && product?.typeHidden !== true;
}
