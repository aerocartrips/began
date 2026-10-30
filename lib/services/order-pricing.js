import { ApiError } from "@/lib/utils/api-error";

/**
 * @param {{ minimumOrderQuantity?: number, wholesalePrice: number, bulkPricingTiers?: { minQuantity: number, pricePerUnit: number }[], price: number, name: string }} product
 * @param {number} quantity
 */
export function resolveUnitPrice(product, quantity) {
  const moq = product.minimumOrderQuantity ?? 1;
  if (quantity < moq) {
    throw new ApiError(
      422,
      `Minimum order quantity for ${product.name} is ${moq}.`,
      [{ field: "items", message: `Minimum order quantity for ${product.name} is ${moq}.` }],
    );
  }

  const tiers = product.bulkPricingTiers ?? [];
  if (tiers.length > 0) {
    const sorted = [...tiers].sort((left, right) => right.minQuantity - left.minQuantity);
    const matched = sorted.find((tier) => quantity >= tier.minQuantity);
    if (matched) return matched.pricePerUnit;
  }

  return product.wholesalePrice ?? product.price;
}

/**
 * @param {number} subtotal
 */
export function calculateTax(subtotal) {
  const rate = Number(process.env.TAX_RATE_PERCENT ?? 0);
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return Math.round(subtotal * (rate / 100) * 100) / 100;
}

/**
 * @param {number} subtotal
 */
export function calculateShipping(subtotal) {
  const flat = Number(process.env.SHIPPING_FLAT_AMOUNT ?? 0);
  const freeThreshold = Number(process.env.SHIPPING_FREE_THRESHOLD ?? 0);
  if (!Number.isFinite(flat) || flat < 0) return 0;
  if (Number.isFinite(freeThreshold) && freeThreshold > 0 && subtotal >= freeThreshold) {
    return 0;
  }
  return flat;
}

/**
 * @param {{ lineTotal: number }[]} lineItems
 */
export function calculateOrderTotals(lineItems) {
  const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const discount = 0;
  const shippingCharges = calculateShipping(subtotal);
  const taxableBase = subtotal - discount + shippingCharges;
  const tax = calculateTax(taxableBase);
  const totalAmount = Math.round((taxableBase + tax) * 100) / 100;
  return { subtotal, discount, shippingCharges, tax, totalAmount };
}

export function rupeesToPaise(rupees) {
  return Math.round(Number(rupees) * 100);
}

export function paiseToRupees(paise) {
  return Number(paise) / 100;
}

export function generateOrderNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `NS-${stamp}-${suffix}`;
}
