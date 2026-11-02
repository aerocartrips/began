import { ApiError } from "@/lib/utils/api-error";
import { minimumQuantityFor, roundRupees, unitPriceFor } from "@/lib/catalog/pricing";

/**
 * Per-piece price for `quantity`, enforcing the minimum order quantity in wholesale stores.
 * @param {import("@/lib/catalog/pricing").PricedProduct & { name: string }} product
 * @param {number} quantity
 * @param {import("@/lib/catalog/pricing").SalesMode} salesMode
 */
export function resolveUnitPrice(product, quantity, salesMode) {
  const minimum = minimumQuantityFor(product, salesMode);
  if (quantity < minimum) {
    const message = `Minimum order quantity for ${product.name} is ${minimum}.`;
    throw new ApiError(422, message, [{ field: "items", message }]);
  }
  return unitPriceFor(product, quantity, salesMode);
}

/**
 * @typedef {{ defaultGstRatePercent?: number, shippingFlatAmount?: number, shippingFreeThreshold?: number }} CommerceSettings
 */

/**
 * @param {number} subtotal
 * @param {CommerceSettings} commerce
 */
export function calculateShipping(subtotal, commerce = {}) {
  const flat = Number(commerce.shippingFlatAmount ?? 0);
  const freeThreshold = Number(commerce.shippingFreeThreshold ?? 0);
  if (!Number.isFinite(flat) || flat <= 0) return 0;
  if (freeThreshold > 0 && subtotal >= freeThreshold) return 0;
  return flat;
}

/**
 * GST is charged on top of prices: each line at its product's rate (or the
 * store default), and shipping at the store default rate.
 * @param {{ lineTotal: number, gstRatePercent?: number | null }[]} lineItems
 * @param {CommerceSettings} commerce
 */
export function calculateOrderTotals(lineItems, commerce = {}) {
  const defaultRate = Number(commerce.defaultGstRatePercent ?? 0);
  const subtotal = roundRupees(lineItems.reduce((sum, item) => sum + item.lineTotal, 0));
  const discount = 0;
  const shippingCharges = calculateShipping(subtotal, commerce);
  const lineTax = lineItems.reduce(
    (sum, item) => sum + item.lineTotal * ((item.gstRatePercent ?? defaultRate) / 100),
    0,
  );
  const tax = roundRupees(lineTax + shippingCharges * (defaultRate / 100));
  const totalAmount = roundRupees(subtotal - discount + shippingCharges + tax);
  return { subtotal, discount, shippingCharges, tax, totalAmount };
}

export function rupeesToPaise(rupees) {
  return Math.round(Number(rupees) * 100);
}

export function paiseToRupees(paise) {
  return Number(paise) / 100;
}

/**
 * @param {string} storeSlug prefix source, e.g. "aurum" → "AUR-20261102-K3F9QZ"
 */
export function generateOrderNumber(storeSlug = "ORD") {
  const prefix = storeSlug.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "ORD";
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0");
  return `${prefix}-${stamp}-${suffix}`;
}
