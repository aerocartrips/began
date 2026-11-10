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
  imagePublicId?: string;
  minimumQuantity?: number;
  available?: number;
  /** Per-piece price before quantity tiers. */
  basePrice?: number;
  /** Retail "was" price, when higher than the price. */
  compareAtPrice?: number | null;
  unitPrice?: number;
  lineTotal?: number;
  tiers?: PriceTier[];
  gstRatePercent?: number | null;
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
  /** Distinct GST rates in the tax total, e.g. [5]. */
  gstRates: number[];
};
