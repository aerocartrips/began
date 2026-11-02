import type { PriceTier } from "@/features/catalog/types";

/** What the browser stores: identifiers and quantities only, never prices. */
export type CartItem = {
  productId: string;
  variantId: string | null;
  quantity: number;
};

export type LineIssue = { field: string; message: string };

/** A cart line priced by the server with the store's rules. */
export type PricedCartLine = CartItem & {
  unavailable?: boolean;
  slug?: string;
  name?: string;
  sku?: string;
  colorName?: string;
  colorHex?: string;
  imageUrl?: string;
  minimumQuantity?: number;
  available?: number;
  unitPrice?: number;
  lineTotal?: number;
  tiers?: PriceTier[];
  issues?: LineIssue[];
};

export type CartTotals = {
  subtotal: number;
  discount: number;
  shippingCharges: number;
  tax: number;
  totalAmount: number;
};

export type CartPricing = {
  salesMode: "wholesale" | "retail";
  lines: PricedCartLine[];
  totals: CartTotals;
  issues: LineIssue[];
};
