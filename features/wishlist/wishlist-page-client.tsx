"use client";

import { useEffect } from "react";
import { Heart } from "lucide-react";
import ProductGrid from "@/components/catalog/product-grid";
import { useProductCards } from "@/components/catalog/product-strip";
import EmptyState from "@/components/ui/empty-state";
import Button from "@/components/ui/button";
import ProductGridSkeleton from "@/components/ui/loaders/product-grid-skeleton";
import { useHydrated } from "@/lib/client/persistent-store";
import { useTenant } from "@/features/tenant/tenant-provider";
import { useWishlist, wishlistActions } from "@/features/wishlist/wishlist-store";

export default function WishlistPageClient() {
  const hydrated = useHydrated();
  const { salesMode } = useTenant();
  const ids = useWishlist();
  const { cards, loading } = useProductCards(hydrated ? [...ids].reverse() : []);

  useEffect(() => {
    void wishlistActions.sync();
  }, []);

  return (
    <main className="catalog-page content-width">
      <header className="catalog-header">
        <div>
          <h1>Wishlist</h1>
          <p>Products you saved. Sign in to keep them across devices.</p>
        </div>
      </header>
      {!hydrated || loading ? (
        <ProductGridSkeleton count={4} />
      ) : cards.length === 0 ? (
        <EmptyState
          icon={<Heart size={20} />}
          title="Your wishlist is empty"
          description="Tap the heart on any product to save it here."
          action={<Button href="/products">Browse the catalogue</Button>}
        />
      ) : (
        <ProductGrid products={cards} salesMode={salesMode} label="Saved products" />
      )}
    </main>
  );
}
