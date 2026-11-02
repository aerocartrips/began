import mongoose from "mongoose";
import { ApiError } from "@/lib/utils/api-error";
import { PRODUCT_STATUS } from "@/lib/constants/product-status";
import { Product } from "@/lib/db/models/Product";
import { getStoreSettingsDocument } from "@/lib/db/models/StoreSettings";
import { minimumQuantityFor, priceTiersFor, roundRupees, unitPriceFor } from "@/lib/catalog/pricing";
import { calculateOrderTotals } from "@/lib/services/order-pricing";
import { getActiveTenant } from "@/lib/tenant/active";

/**
 * @typedef {{ productId: string, variantId?: string | null, quantity: number }} CartItemInput
 * @typedef {{ field: string, message: string }} LineIssue
 */

const PRODUCT_FIELDS =
  "name slug sku status images variants price compareAtPrice wholesalePrice bulkPricingTiers minimumOrderQuantity stockQuantity gstRatePercent hsnCode";

function imageUrlOf(images) {
  const image = images?.find((entry) => entry.isPrimary) ?? images?.[0];
  return image?.secureUrl || image?.url || "";
}

/**
 * Prices cart items with the current store's rules (sales mode, tiers, MOQ,
 * stock, GST). In `strict` mode (order creation) any problem throws; otherwise
 * problems are reported per line so the cart can show them.
 * @param {CartItemInput[]} items
 * @param {{ strict?: boolean }} [options]
 */
export async function priceCartItems(items, { strict = false } = {}) {
  const tenant = await getActiveTenant();
  const salesMode = tenant.salesMode;
  const validIds = [...new Set(items.map((item) => item.productId))].filter((id) => mongoose.isValidObjectId(id));
  const [products, settings] = await Promise.all([
    Product.find({ _id: { $in: validIds } }).select(PRODUCT_FIELDS).lean(),
    getStoreSettingsDocument(),
  ]);
  const productMap = new Map(products.map((product) => [String(product._id), product]));
  const issues = [];
  const lines = [];

  for (const item of items) {
    /** @type {LineIssue[]} */
    const lineIssues = [];
    const product = productMap.get(item.productId);
    if (!product || product.status !== PRODUCT_STATUS.ACTIVE) {
      issues.push({ field: "items", message: "A product in your cart is no longer available." });
      lines.push({ productId: item.productId, variantId: item.variantId ?? null, quantity: item.quantity, unavailable: true });
      continue;
    }

    const variant = item.variantId
      ? product.variants?.find((entry) => String(entry._id) === item.variantId)
      : null;
    if (product.variants?.length && !variant) {
      lineIssues.push({ field: "variantId", message: `Choose a colour for ${product.name}.` });
    }

    const available = variant ? variant.stockQuantity : product.stockQuantity;
    const minimum = minimumQuantityFor(product, salesMode);
    if (item.quantity < minimum) {
      lineIssues.push({ field: "quantity", message: `Minimum order quantity for ${product.name} is ${minimum}.` });
    }
    if (item.quantity > available) {
      lineIssues.push({
        field: "quantity",
        message: available > 0 ? `Only ${available} of ${product.name} available.` : `${product.name} is out of stock.`,
      });
    }

    const unitPrice = unitPriceFor(product, item.quantity, salesMode);
    lines.push({
      productId: String(product._id),
      variantId: variant ? String(variant._id) : null,
      slug: product.slug,
      name: product.name,
      sku: variant?.sku ?? product.sku,
      colorName: variant?.colorName ?? "",
      colorHex: variant?.colorHex ?? "",
      imageUrl: imageUrlOf(variant?.images?.length ? variant.images : product.images),
      quantity: item.quantity,
      minimumQuantity: minimum,
      available,
      unitPrice,
      lineTotal: roundRupees(unitPrice * item.quantity),
      tiers: priceTiersFor(product, salesMode),
      gstRatePercent: product.gstRatePercent ?? null,
      hsnCode: product.hsnCode ?? "",
      issues: lineIssues,
    });
    issues.push(...lineIssues);
  }

  if (strict && issues.length) {
    throw new ApiError(422, issues[0].message, issues);
  }

  const priced = lines.filter((line) => !line.unavailable);
  return {
    salesMode,
    lines,
    issues,
    totals: calculateOrderTotals(priced, settings.commerce),
  };
}
