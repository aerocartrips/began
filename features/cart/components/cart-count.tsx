"use client";

import CountBadge from "@/components/ui/count-badge";
import { useCartCount } from "@/features/cart/cart-store";
import { useHydrated } from "@/lib/client/persistent-store";

/** The header cart link's name and badge: "Shopping cart, 42 items" (pieces in the cart). */
export default function CartCount() {
  const hydrated = useHydrated();
  const count = useCartCount();
  return (
    <>
      <span className="sr-only">Shopping cart</span>
      <CountBadge count={hydrated ? count : 0} corner label="items" />
    </>
  );
}
