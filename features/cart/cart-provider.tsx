"use client";

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type ReactNode,
} from "react";
import { getCatalogProductById } from "@/features/products/catalog-lookup";
import { getProductById as getStaticProductById } from "@/data/products";
import { cartReducer, initialCartState } from "@/features/cart/cart-reducer";
import {
  BUY_NOW_STORAGE_KEY,
  CART_STORAGE_KEY,
  getCartItemKey,
  sanitizeStoredItems,
  validateCartItem,
} from "@/features/cart/utils/cart";
import type {
  CartContextValue,
  CartLine,
  CartMutationResult,
  StoredCartItem,
} from "@/features/cart/types/cart";

const CartContext = createContext<CartContextValue | null>(null);

function readStorage(key: string) {
  try {
    return { value: window.localStorage.getItem(key), failed: false };
  } catch {
    return { value: null, failed: true };
  }
}

function readBuyNowIntent() {
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(BUY_NOW_STORAGE_KEY) ?? "null");
    return sanitizeStoredItems(value ? [value] : [])[0] ?? null;
  } catch {
    return null;
  }
}

function createCartLines(items: StoredCartItem[]): CartLine[] {
  return items.flatMap((item) => {
    const product = getCatalogProductById(item.productId) ?? getStaticProductById(item.productId);
    if (!product) return [];
    return [{
      ...item,
      key: getCartItemKey(item),
      product,
      lineTotalCents: product.priceCents * item.quantity,
    }];
  });
}

function getAddResult(item: StoredCartItem, existingItems: StoredCartItem[]): CartMutationResult {
  const validation = validateCartItem(item);
  if (!validation.ok) return validation;

  const key = getCartItemKey(validation.item);
  const existing = existingItems.find((candidate) => getCartItemKey(candidate) === key);
  if (existing && existing.quantity + item.quantity > validation.product.inventory) {
    return {
      ok: false,
      message: `Only ${validation.product.inventory.toLocaleString("en-US")} units are available.`,
    };
  }

  return { ok: true, message: `${validation.product.title} added to your cart.` };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialCartState);

  useEffect(() => {
    let items: StoredCartItem[] = [];
    const storedCart = readStorage(CART_STORAGE_KEY);
    if (storedCart.failed) {
      dispatch({
        type: "set-storage-warning",
        message: "Browser storage is unavailable. Cart changes will be temporary.",
      });
    }
    try {
      const persisted = storedCart.value;
      if (persisted) {
        const parsed: unknown = JSON.parse(persisted);
        if (
          typeof parsed === "object" && parsed !== null && "items" in parsed
        ) {
          items = sanitizeStoredItems(parsed.items);
        }
      }
    } catch {
      dispatch({
        type: "set-storage-warning",
        message: "Saved cart data could not be read. A new cart has been started.",
      });
    }

    dispatch({ type: "hydrate", items, checkoutIntent: readBuyNowIntent() });
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    try {
      window.localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify({ version: 1, items: state.items }),
      );
    } catch {
      dispatch({
        type: "set-storage-warning",
        message: "Cart changes are temporary because browser storage is unavailable.",
      });
    }
  }, [state.hydrated, state.items]);

  const items = createCartLines(state.items);
  const checkoutIntent = state.checkoutIntent
    ? createCartLines([state.checkoutIntent])[0] ?? null
    : null;
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const subtotalCents = items.reduce((total, item) => total + item.lineTotalCents, 0);

  function addItem(item: StoredCartItem): CartMutationResult {
    const result = getAddResult(item, state.items);
    if (!result.ok) return result;
    const validation = validateCartItem(item);
    if (validation.ok) {
      dispatch({
        type: "add",
        item: validation.item,
        key: getCartItemKey(validation.item),
      });
    }
    return result;
  }

  function updateQuantity(key: string, quantity: number): CartMutationResult {
    const item = state.items.find((candidate) => getCartItemKey(candidate) === key);
    if (!item) return { ok: false, message: "This cart item is no longer available." };
    const result = validateCartItem({ ...item, quantity });
    if (!result.ok) return result;
    dispatch({ type: "update", key, quantity });
    return { ok: true, message: "Cart quantity updated." };
  }

  function beginBuyNow(item: StoredCartItem): CartMutationResult {
    const validation = validateCartItem(item);
    if (!validation.ok) return validation;
    try {
      window.sessionStorage.setItem(BUY_NOW_STORAGE_KEY, JSON.stringify(validation.item));
      dispatch({ type: "set-checkout-intent", item: validation.item });
      return { ok: true, message: "Ready to continue to checkout." };
    } catch {
      return { ok: false, message: "The purchase session could not be started. Please try again." };
    }
  }

  function clearBuyNow() {
    try {
      window.sessionStorage.removeItem(BUY_NOW_STORAGE_KEY);
    } catch {
      dispatch({
        type: "set-storage-warning",
        message: "The temporary purchase session could not be cleared.",
      });
    }
    dispatch({ type: "set-checkout-intent", item: null });
  }

  const value: CartContextValue = {
    items,
    itemCount,
    subtotalCents,
    hydrated: state.hydrated,
    checkoutIntent,
    storageWarning: state.storageWarning,
    addItem,
    updateQuantity,
    removeItem: (key) => dispatch({ type: "remove", key }),
    clearCart: () => dispatch({ type: "clear" }),
    beginBuyNow,
    clearBuyNow,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider.");
  return context;
}