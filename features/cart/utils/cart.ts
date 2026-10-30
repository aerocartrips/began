import { getCatalogProductById } from "@/features/products/catalog-lookup";
import { getProductById as getStaticProductById } from "@/data/products";
import type { Product } from "@/features/products/types/product";
import type { SelectedOptions, StoredCartItem } from "@/features/cart/types/cart";

function resolveProduct(productId: string): Product | undefined {
  return getCatalogProductById(productId) ?? getStaticProductById(productId);
}

export const CART_STORAGE_KEY = "neovastra:cart:v1";
export const BUY_NOW_STORAGE_KEY = "neovastra:buy-now:v1";

export function getCartItemKey(item: StoredCartItem) {
  const options = Object.entries(item.selectedOptions).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  return `${item.productId}:${JSON.stringify(options)}`;
}

export function normalizeSelectedOptions(
  product: Product,
  selectedOptions: SelectedOptions,
): SelectedOptions | null {
  const normalized: Record<string, string> = {};

  for (const option of product.options) {
    const valueId = selectedOptions[option.id];
    if (!valueId) {
      if (option.required !== false) return null;
      continue;
    }

    const value = option.values.find((candidate) => candidate.id === valueId);
    if (!value || value.available === false) return null;
    normalized[option.id] = value.id;
  }

  return normalized;
}

export function validateCartItem(item: StoredCartItem) {
  const product = resolveProduct(item.productId);
  if (!product) return { ok: false as const, message: "This product is no longer available." };
  if (!Number.isSafeInteger(item.quantity) || item.quantity < product.minimumOrderQuantity) {
    return {
      ok: false as const,
      message: `Minimum order quantity is ${product.minimumOrderQuantity}.`,
    };
  }
  if (product.inventory < product.minimumOrderQuantity) {
    return { ok: false as const, message: "This product is currently unavailable." };
  }
  if (item.quantity > product.inventory) {
    return {
      ok: false as const,
      message: `Only ${product.inventory.toLocaleString("en-US")} units are available.`,
    };
  }

  const selectedOptions = normalizeSelectedOptions(product, item.selectedOptions);
  if (!selectedOptions) {
    return { ok: false as const, message: "Choose valid options for this product." };
  }

  return {
    ok: true as const,
    product,
    item: { ...item, selectedOptions },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sanitizeStoredItems(value: unknown): StoredCartItem[] {
  if (!Array.isArray(value)) return [];

  const uniqueItems = new Map<string, StoredCartItem>();
  for (const candidate of value) {
    if (!isRecord(candidate) || typeof candidate.productId !== "string") continue;
    if (typeof candidate.quantity !== "number" || !isRecord(candidate.selectedOptions)) continue;

    const selectedOptions: Record<string, string> = {};
    for (const [optionId, valueId] of Object.entries(candidate.selectedOptions)) {
      if (typeof valueId === "string") selectedOptions[optionId] = valueId;
    }

    const validation = validateCartItem({
      productId: candidate.productId,
      quantity: candidate.quantity,
      selectedOptions,
    });
    if (!validation.ok) continue;

    const key = getCartItemKey(validation.item);
    const existing = uniqueItems.get(key);
    const quantity = Math.min(
      validation.product.inventory,
      (existing?.quantity ?? 0) + validation.item.quantity,
    );
    if (quantity >= validation.product.minimumOrderQuantity) {
      uniqueItems.set(key, { ...validation.item, quantity });
    }
  }

  return [...uniqueItems.values()];
}