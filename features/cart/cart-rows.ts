import { priceForQuantity, roundRupees } from "@/lib/catalog/pricing";
import { formatNumber } from "@/lib/format";
import { lineKey } from "@/features/cart/use-cart-pricing";
import type { PriceTier } from "@/features/catalog/types";
import type { CartItem, PricedCartLine } from "@/features/cart/types";

/**
 * Why a line can't be ordered as it is. Derived from the line's pricing data
 * with the server's rules (lib/services/cart-pricing.service.js), so it updates
 * the moment the shopper changes a quantity.
 */
export type LineProblem =
  | { kind: "unavailable" }
  | { kind: "colour" }
  /** Fewer in stock than the minimum order (0 = out of stock). */
  | { kind: "soldOut"; available: number; minimum: number }
  | { kind: "stock"; available: number }
  | { kind: "minimum"; minimum: number };

export type CartRow = {
  key: string;
  item: CartItem;
  /** The server's pricing for this line, possibly for an earlier quantity; null until it first arrives. */
  line: PricedCartLine | null;
  /** The quantity changed since the server priced it (prices shown are worked out here meanwhile). */
  repricing: boolean;
  basePrice: number;
  unitPrice: number;
  lineTotal: number;
  /** Saved against the base price (wholesale tiers) or the "was" price (retail). */
  saving: number;
  /** The next quantity tier this line could reach with the stock available. */
  nextTier: PriceTier | null;
  problem: LineProblem | null;
};

export function lineProblem(line: PricedCartLine | null, quantity: number): LineProblem | null {
  if (!line) return null;
  if (line.unavailable) return { kind: "unavailable" };
  if (line.issues?.some((issue) => issue.field === "variantId")) return { kind: "colour" };
  const available = line.available ?? 0;
  const minimum = line.minimumQuantity ?? 1;
  if (available < minimum) return { kind: "soldOut", available, minimum };
  if (quantity > available) return { kind: "stock", available };
  if (quantity < minimum) return { kind: "minimum", minimum };
  return null;
}

export function lineProblemText(problem: LineProblem, unit: string) {
  switch (problem.kind) {
    case "unavailable":
      return "This product is no longer available.";
    case "colour":
      return "This colour is no longer offered. Choose another on the product page.";
    case "soldOut":
      return problem.available > 0
        ? `Only ${formatNumber(problem.available)} left, below the minimum order of ${formatNumber(problem.minimum)} ${unit}.`
        : "Out of stock.";
    case "stock":
      return `Only ${formatNumber(problem.available)} ${unit} available.`;
    case "minimum":
      return `Minimum order is ${formatNumber(problem.minimum)} ${unit}.`;
  }
}

/** The quantity that resolves a problem in place, if one does. */
export function problemFix(problem: LineProblem) {
  if (problem.kind === "stock") return problem.available;
  if (problem.kind === "minimum") return problem.minimum;
  return null;
}

/** One row per cart item, in cart order: the cart holds the quantities, the server the prices. */
export function cartRows(items: CartItem[], linesByKey: Map<string, PricedCartLine>): CartRow[] {
  return items.map((item) => {
    const key = lineKey(item);
    const line = linesByKey.get(key) ?? null;
    const repricing = line !== null && line.quantity !== item.quantity;
    const tiers = line?.tiers ?? [];
    const basePrice = line?.basePrice ?? line?.unitPrice ?? 0;
    let unitPrice = 0;
    let lineTotal = 0;
    if (line && !line.unavailable) {
      // Same rule as the server, so the price never jumps when its answer arrives.
      unitPrice = repricing ? priceForQuantity(basePrice, tiers, item.quantity) : line.unitPrice ?? 0;
      lineTotal = repricing ? roundRupees(unitPrice * item.quantity) : line.lineTotal ?? 0;
    }
    const listPrice = Math.max(basePrice, line?.compareAtPrice ?? 0);
    return {
      key,
      item,
      line,
      repricing,
      basePrice,
      unitPrice,
      lineTotal,
      saving: unitPrice > 0 && listPrice > unitPrice ? roundRupees((listPrice - unitPrice) * item.quantity) : 0,
      nextTier: tiers.find((tier) => tier.minQuantity > item.quantity && tier.minQuantity <= (line?.available ?? 0)) ?? null,
      problem: lineProblem(line, item.quantity),
    };
  });
}

export { gstLabel, unitLabel } from "@/features/cart/labels";
