import type { Product } from "@/features/products/types/product";

export type SelectedOptions = Readonly<Record<string, string>>;

export type StoredCartItem = {
  productId: string;
  quantity: number;
  selectedOptions: SelectedOptions;
};

export type CartLine = StoredCartItem & {
  key: string;
  product: Product;
  lineTotalCents: number;
};

export type CartMutationResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export type CartContextValue = {
  items: CartLine[];
  itemCount: number;
  subtotalCents: number;
  hydrated: boolean;
  checkoutIntent: CartLine | null;
  storageWarning: string | null;
  addItem: (item: StoredCartItem) => CartMutationResult;
  updateQuantity: (key: string, quantity: number) => CartMutationResult;
  removeItem: (key: string) => void;
  clearCart: () => void;
  beginBuyNow: (item: StoredCartItem) => CartMutationResult;
  clearBuyNow: () => void;
};