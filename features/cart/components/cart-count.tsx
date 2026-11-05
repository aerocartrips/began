"use client";

import { useCartCount } from "@/features/cart/cart-store";
import { useHydrated } from "@/lib/client/persistent-store";
import { formatNumber } from "@/lib/format";

export default function CartCount() {
  const hydrated = useHydrated();
  const count = useCartCount();
  const value = hydrated ? count : 0;
  return (
    <span className="cart-count" data-count={value} aria-live="polite" aria-atomic="true">
      {formatNumber(value)}
    </span>
  );
}
