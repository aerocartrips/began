import type { StoredCartItem } from "@/features/cart/types/cart";
import { getCartItemKey } from "@/features/cart/utils/cart";

export type CartState = {
  items: StoredCartItem[];
  checkoutIntent: StoredCartItem | null;
  storageWarning: string | null;
  hydrated: boolean;
};

export type CartAction =
  | { type: "hydrate"; items: StoredCartItem[]; checkoutIntent: StoredCartItem | null }
  | { type: "add"; item: StoredCartItem; key: string }
  | { type: "update"; key: string; quantity: number }
  | { type: "remove"; key: string }
  | { type: "clear" }
  | { type: "set-checkout-intent"; item: StoredCartItem | null }
  | { type: "set-storage-warning"; message: string };

export const initialCartState: CartState = {
  items: [],
  checkoutIntent: null,
  storageWarning: null,
  hydrated: false,
};

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "hydrate":
      return {
        items: action.items,
        checkoutIntent: action.checkoutIntent,
        storageWarning: state.storageWarning,
        hydrated: true,
      };
    case "add": {
      const existing = state.items.find(
        (item) => getCartItemKey(item) === action.key,
      );
      if (!existing) return { ...state, items: [...state.items, action.item] };
      return {
        ...state,
        items: state.items.map((item) =>
          item === existing ? { ...item, quantity: item.quantity + action.item.quantity } : item,
        ),
      };
    }
    case "update":
      return {
        ...state,
        items: state.items.map((item) =>
          getCartItemKey(item) === action.key
            ? { ...item, quantity: action.quantity }
            : item,
        ),
      };
    case "remove":
      return {
        ...state,
        items: state.items.filter(
          (item) => getCartItemKey(item) !== action.key,
        ),
      };
    case "clear":
      return { ...state, items: [] };
    case "set-checkout-intent":
      return { ...state, checkoutIntent: action.item };
    case "set-storage-warning":
      return { ...state, storageWarning: action.message };
  }
}