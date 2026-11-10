import { createPersistentStore } from "@/lib/client/persistent-store";
import type { CartItem } from "@/features/cart/types";
import { trackProductActivity } from "@/features/catalog/activity";
import { trackEvent } from "@/features/analytics/analytics";

const OBJECT_ID = /^[a-f\d]{24}$/i;
const MAX_LINES = 100;
const MAX_QUANTITY = 100000;

function sanitizeItem(raw: unknown): CartItem | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { productId, variantId, quantity } = raw as Record<string, unknown>;
  if (typeof productId !== "string" || !OBJECT_ID.test(productId)) return null;
  if (variantId != null && (typeof variantId !== "string" || !OBJECT_ID.test(variantId))) return null;
  const count = Math.trunc(Number(quantity));
  if (!Number.isFinite(count) || count < 1) return null;
  return { productId, variantId: (variantId as string | null) ?? null, quantity: Math.min(count, MAX_QUANTITY) };
}

function sanitizeItems(raw: unknown): CartItem[] {
  const list = typeof raw === "object" && raw !== null && "items" in raw ? (raw as { items: unknown }).items : raw;
  return Array.isArray(list) ? list.map(sanitizeItem).filter((item): item is CartItem => item !== null).slice(0, MAX_LINES) : [];
}

const sameLine = (left: CartItem, right: Pick<CartItem, "productId" | "variantId">) =>
  left.productId === right.productId && (left.variantId ?? null) === (right.variantId ?? null);

/** Browser storage is per domain, so each store has its own cart. */
export const cartStore = createPersistentStore<CartItem[]>("cart:v2", [], sanitizeItems);

/** Single item for "Buy now", kept for this tab only. */
export const buyNowStore = createPersistentStore<CartItem | null>("buy-now:v2", null, sanitizeItem, "session");

export const cartActions = {
  add(item: CartItem) {
    trackProductActivity(item.productId, "cart");
    trackEvent("cart_add", { target: item.productId });
    return cartStore.set((items) => {
      const existing = items.find((candidate) => sameLine(candidate, item));
      if (existing) {
        return items.map((candidate) =>
          candidate === existing ? { ...candidate, quantity: Math.min(candidate.quantity + item.quantity, MAX_QUANTITY) } : candidate,
        );
      }
      return [...items, item].slice(-MAX_LINES);
    });
  },
  setQuantity(line: Pick<CartItem, "productId" | "variantId">, quantity: number) {
    const count = Math.min(Math.max(1, Math.trunc(quantity)), MAX_QUANTITY);
    return cartStore.set((items) => items.map((item) => (sameLine(item, line) ? { ...item, quantity: count } : item)));
  },
  remove(line: Pick<CartItem, "productId" | "variantId">) {
    return cartStore.set((items) => items.filter((item) => !sameLine(item, line)));
  },
  /** Undo for remove(): puts the line back where it was, unless it was added again meanwhile. */
  restore(item: CartItem, index: number) {
    return cartStore.set((items) =>
      items.some((candidate) => sameLine(candidate, item))
        ? items
        : [...items.slice(0, index), item, ...items.slice(index)].slice(0, MAX_LINES),
    );
  },
  clear() {
    return cartStore.set([]);
  },
  /** Undo for clear(): the lines as they were. */
  replace(items: CartItem[]) {
    return cartStore.set(sanitizeItems(items));
  },
  beginBuyNow(item: CartItem) {
    return buyNowStore.set(item);
  },
  clearBuyNow() {
    return buyNowStore.set(null);
  },
};

export function useCartItems() {
  return cartStore.use();
}

export function useCartCount() {
  return cartStore.use().reduce((total, item) => total + item.quantity, 0);
}
