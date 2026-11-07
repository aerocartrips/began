"use client";

import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";
import CartLine from "@/features/cart/components/cart-line";
import CartSummary from "@/features/cart/components/cart-summary";
import { cartActions, useCartItems } from "@/features/cart/cart-store";
import { useCartPricing } from "@/features/cart/use-cart-pricing";
import { useTenant } from "@/features/tenant/tenant-provider";
import { useHydrated } from "@/lib/client/persistent-store";
import { formatNumber, formatRupees } from "@/lib/format";
import CartSkeleton from "@/components/ui/loaders/cart-skeleton";
import MobileActionBar from "@/components/layout/mobile-action-bar";
import EmptyState from "@/components/ui/empty-state";
import Button from "@/components/ui/button";

export default function CartPageClient() {
  const hydrated = useHydrated();
  const items = useCartItems();
  const { salesMode } = useTenant();
  const { pricing, loading, error } = useCartPricing(items);
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);

  if (!hydrated) return <CartSkeleton />;

  if (items.length === 0) {
    return (
      <main className="commerce-page content-width">
        <EmptyState
          icon={<ShoppingBag size={20} />}
          title="Your cart is empty"
          description="Browse the catalogue and add products to get started."
          action={<Button href="/products">Browse catalogue</Button>}
        />
      </main>
    );
  }

  const blocked = Boolean(error) || (pricing?.issues.length ?? 0) > 0;

  return (
    <main className="commerce-page content-width">
      <div className="commerce-heading">
        <div>
          <p className="eyebrow">{salesMode === "wholesale" ? "Wholesale order" : "Your order"}</p>
          <h1>Your cart</h1>
        </div>
        <button type="button" className="text-button" onClick={() => cartActions.clear()}>
          Clear cart
        </button>
      </div>
      {error ? <p className="commerce-notice" role="alert">{error}</p> : null}
      {pricing?.issues.length ? (
        <p className="commerce-notice" role="status">Fix the highlighted items to continue to checkout.</p>
      ) : null}
      <div className="cart-layout">
        <section className="cart-items" aria-label="Cart items" aria-busy={loading}>
          {(pricing?.lines ?? []).map((line) => (
            <CartLine key={`${line.productId}:${line.variantId ?? ""}`} line={line} />
          ))}
          {!pricing && loading ? <CartSkeleton /> : null}
        </section>
        <CartSummary
          itemCount={itemCount}
          totals={pricing?.totals ?? null}
          loading={loading}
          checkoutDisabled={blocked}
          secondaryAction={
            salesMode === "wholesale" ? (
              <Link className="continue-shopping" href="/request-quote?from=cart">Request a quote for this cart</Link>
            ) : null
          }
        />
      </div>
      {/* Phones: the total and the way forward stay on screen while the cart scrolls. */}
      <MobileActionBar className="cart-checkout-bar">
        <p className="cart-checkout-bar__total">
          <span>Total · {formatNumber(itemCount)} pcs</span>
          <strong>{loading || !pricing ? "…" : formatRupees(pricing.totals.totalAmount)}</strong>
        </p>
        {blocked || loading ? (
          <button type="button" className="button button-primary" disabled>
            Checkout
          </button>
        ) : (
          <Button href="/checkout" icon={<ArrowRight size={16} aria-hidden="true" />}>
            Checkout
          </Button>
        )}
      </MobileActionBar>
    </main>
  );
}
