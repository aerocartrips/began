"use client";

import { useCart } from "@/features/cart/cart-provider";

export default function CartCount() {
  const { itemCount, hydrated } = useCart();
  return (
    <span className="cart-count" aria-live="polite" aria-atomic="true">
      {hydrated ? itemCount.toLocaleString("en-US") : "0"}
    </span>
  );
}