"use client";

import { Heart } from "lucide-react";
import { useHydrated } from "@/lib/client/persistent-store";
import { useWishlist, wishlistActions } from "@/features/wishlist/wishlist-store";

export default function WishlistButton({ productId, productName, className = "wishlist-toggle" }: {
  productId: string;
  productName: string;
  className?: string;
}) {
  const hydrated = useHydrated();
  const saved = useWishlist().includes(productId) && hydrated;
  return (
    <button
      type="button"
      className={className}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${productName} from wishlist` : `Save ${productName} to wishlist`}
      onClick={() => void wishlistActions.toggle(productId)}
    >
      <Heart size={17} aria-hidden="true" fill={saved ? "currentColor" : "none"} />
    </button>
  );
}
