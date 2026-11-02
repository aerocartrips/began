"use client";

import { useCartCount } from "@/features/cart/cart-store";
import { useHydrated } from "@/lib/client/persistent-store";
import { formatNumber } from "@/lib/format";

export default function CartCount() {
  const hydrated = useHydrated();
  const count = useCartCount();
  return (
    <span className="cart-count" aria-live="polite" aria-atomic="true">
      {hydrated ? formatNumber(count) : "0"}
    </span>
  );
}
