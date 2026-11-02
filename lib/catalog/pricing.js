/**
 * Pricing rules shared by the product page, cart pricing and order creation,
 * so what a shopper sees is exactly what an order charges. Amounts are rupees.
 *
 * @typedef {"wholesale" | "retail"} SalesMode
 * @typedef {{
 *   price: number,
 *   compareAtPrice?: number,
 *   wholesalePrice: number,
 *   minimumOrderQuantity?: number,
 *   bulkPricingTiers?: { minQuantity: number, pricePerUnit: number }[],
 * }} PricedProduct
 */

/**
 * @param {PricedProduct} product
 * @param {SalesMode} salesMode
 */
export function minimumQuantityFor(product, salesMode) {
  return salesMode === "wholesale" ? Math.max(1, product.minimumOrderQuantity ?? 1) : 1;
}

/**
 * Quantity tiers in ascending order (wholesale only).
 * @param {PricedProduct} product
 * @param {SalesMode} salesMode
 */
export function priceTiersFor(product, salesMode) {
  if (salesMode !== "wholesale") return [];
  return [...(product.bulkPricingTiers ?? [])]
    .filter((tier) => tier.minQuantity > 0 && tier.pricePerUnit >= 0)
    .sort((left, right) => left.minQuantity - right.minQuantity);
}

/**
 * Headline per-piece price shown on cards and the product page.
 * @param {PricedProduct} product
 * @param {SalesMode} salesMode
 */
export function basePriceFor(product, salesMode) {
  return salesMode === "wholesale" ? product.wholesalePrice ?? product.price : product.price;
}

/**
 * "Was" price for retail stores; wholesale stores do not show strike-through prices.
 * @param {PricedProduct} product
 * @param {SalesMode} salesMode
 */
export function compareAtPriceFor(product, salesMode) {
  if (salesMode !== "retail") return null;
  const compareAt = product.compareAtPrice ?? 0;
  return compareAt > product.price ? compareAt : null;
}

/**
 * Per-piece price for an order of `quantity` pieces.
 * @param {PricedProduct} product
 * @param {number} quantity
 * @param {SalesMode} salesMode
 */
export function unitPriceFor(product, quantity, salesMode) {
  const tiers = priceTiersFor(product, salesMode);
  let price = basePriceFor(product, salesMode);
  for (const tier of tiers) {
    if (quantity >= tier.minQuantity) price = tier.pricePerUnit;
  }
  return price;
}

/**
 * @param {number} amount
 */
export function roundRupees(amount) {
  return Math.round(amount * 100) / 100;
}
