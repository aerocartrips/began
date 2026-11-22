import mongoose from "mongoose";
import { ApiError } from "@/lib/utils/api-error";
import { isListedProduct } from "@/lib/constants/product-status";
import { Product } from "@/lib/db/models/Product";
import { getStoreSettingsDocument } from "@/lib/db/models/StoreSettings";
import { basePriceFor, compareAtPriceFor, minimumQuantityFor, priceTiersFor, roundRupees, unitPriceFor } from "@/lib/catalog/pricing";
import { calculateOrderTotals } from "@/lib/services/order-pricing";
import { getActiveTenant } from "@/lib/tenant/active";
import { getCatalogConfig } from "@/lib/catalog/catalog-config";
import { colourPhotos } from "@/lib/catalog/dto";
import { optionsOf, variantTitleOf } from "@/lib/catalog/variants";

/**
 * @typedef {{ productId: string, variantId?: string | null, quantity: number }} CartItemInput
 * @typedef {{ field: string, message: string }} LineIssue
 */

const PRODUCT_FIELDS =
  "name slug sku status typeHidden images variants colorMedia price compareAtPrice wholesalePrice bulkPricingTiers minimumOrderQuantity stockQuantity gstRatePercent hsnCode";

function primaryImage(images) {
  return images?.find((entry) => entry.isPrimary) ?? images?.[0] ?? null;
}

/**
 * GST rates the totals were taxed at (each line's rate or the store default,
 * plus the default on shipping), so the cart can label the tax "GST (5%)".
 * Mirrors calculateOrderTotals() in lib/services/order-pricing.js.
 */
function gstRatesOf(lines, totals, commerce) {
  const fallback = Number(commerce.defaultGstRatePercent ?? 0);
  const rates = lines.map((line) => line.gstRatePercent ?? fallback);
  if (totals.shippingCharges > 0) rates.push(fallback);
  return [...new Set(rates.filter((rate) => rate > 0))].sort((left, right) => left - right);
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
  const [products, settings, config] = await Promise.all([
    Product.find({ _id: { $in: validIds } }).select(PRODUCT_FIELDS).lean(),
    getStoreSettingsDocument(),
    getCatalogConfig(tenant.id),
  ]);
  const optionName = (key) => config.attributes[key]?.name ?? key;
  const productMap = new Map(products.map((product) => [String(product._id), product]));
  const issues = [];
  const lines = [];

  for (const item of items) {
    /** @type {LineIssue[]} */
    const lineIssues = [];
    const product = productMap.get(item.productId);
    if (!isListedProduct(product)) {
      issues.push({ field: "items", message: "A product in your cart is no longer available." });
      lines.push({ productId: item.productId, variantId: item.variantId ?? null, quantity: item.quantity, unavailable: true });
      continue;
    }

    const variant = item.variantId
      ? product.variants?.find((entry) => String(entry._id) === item.variantId)
      : null;
    if (product.variants?.length && !variant) {
      lineIssues.push({ field: "variantId", message: `Choose an option (such as colour or size) for ${product.name}.` });
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
    const options = optionsOf(variant);
    // The chosen colour's photo, else the product's own.
    const image = (variant ? primaryImage(colourPhotos(product, variant.colorName, variant)) : null) ?? primaryImage(product.images);
    lines.push({
      productId: String(product._id),
      variantId: variant ? String(variant._id) : null,
      slug: product.slug,
      name: product.name,
      sku: variant?.sku ?? product.sku,
      colorName: variant?.colorName ?? "",
      colorHex: variant?.colorHex ?? "",
      variantTitle: variant ? variant.title || variantTitleOf(options, variant.colorName) : "",
      options: Object.entries(options).map(([key, value]) => ({ name: optionName(key), value })),
      imageUrl: image?.secureUrl || image?.url || "",
      imagePublicId: image?.publicId || "",
      quantity: item.quantity,
      minimumQuantity: minimum,
      available,
      // Before quantity tiers (wholesale) and the retail "was" price, so the cart can show savings.
      basePrice: basePriceFor(product, salesMode),
      compareAtPrice: compareAtPriceFor(product, salesMode),
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
  const totals = calculateOrderTotals(priced, settings.commerce);
  return {
    salesMode,
    lines,
    issues,
    totals,
    gstRates: gstRatesOf(priced, totals, settings.commerce),
  };
}
