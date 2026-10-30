"use client";

import CartItem from "@/features/cart/components/cart-item";
import CartSummary from "@/features/cart/components/cart-summary";
import { useCart } from "@/features/cart/cart-provider";
import LoadingButton from "@/components/ui/buttons/LoadingButton";
import CartSkeleton from "@/components/ui/loaders/CartSkeleton";
import EmptyState from "@/components/ui/empty-state";
import Button from "@/components/ui/button";
import { ShoppingBag } from "lucide-react";

export default function CartPageClient() {
  const { items, itemCount, subtotalCents, hydrated, storageWarning, clearCart } = useCart();

  if (!hydrated) {
    return <CartSkeleton />;
  }

  if (items.length === 0) {
    return (
      <main className="commerce-page content-width">
          {storageWarning && <p className="commerce-notice" role="status">{storageWarning}</p>}
        <EmptyState
          icon={<ShoppingBag size={20} />}
          title="Your cart is empty"
          description="Browse the catalog and add a wholesale batch to get started."
          action={<Button href="/products">Browse catalog</Button>}
        />
      </main>
    );
  }

  return (
    <main className="commerce-page content-width">
      <div className="commerce-heading">
        <div>
          <p className="eyebrow">Wholesale order</p>
          <h1>Your Cart</h1>
        </div>
        <LoadingButton
          type="button"
          variant="form"
          className="text-button"
          onClick={clearCart}
        >
          Clear cart
        </LoadingButton>
      </div>
      {storageWarning && <p className="commerce-notice" role="status">{storageWarning}</p>}
      <div className="cart-layout">
        <section className="cart-items" aria-label="Cart items">
          {items.map((item) => <CartItem item={item} key={item.key} />)}
        </section>
        <CartSummary itemCount={itemCount} subtotalCents={subtotalCents} />
      </div>
    </main>
  );
}
