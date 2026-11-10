"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Heart, ShoppingBag } from "lucide-react";
import CartLine from "@/features/cart/components/cart-line";
import CartSummary from "@/features/cart/components/cart-summary";
import { cartRows, unitLabel, type CartRow } from "@/features/cart/cart-rows";
import { cartActions, cartStore, useCartItems } from "@/features/cart/cart-store";
import { useCartPricing } from "@/features/cart/use-cart-pricing";
import { useTenant } from "@/features/tenant/tenant-provider";
import { useWishlist, wishlistActions } from "@/features/wishlist/wishlist-store";
import { useFeedback } from "@/components/feedback/feedback-provider";
import RecentlyViewed from "@/components/catalog/recently-viewed";
import MobileActionBar from "@/components/layout/mobile-action-bar";
import NoticeCard from "@/components/ui/feedback/notice-card";
import CartSkeleton from "@/components/ui/loaders/cart-skeleton";
import EmptyState from "@/components/ui/empty-state";
import Button from "@/components/ui/button";
import { useHydrated } from "@/lib/client/persistent-store";
import type { PurchaseTerm } from "@/lib/catalog/purchase-terms";
import { formatNumber, formatRupees } from "@/lib/format";

type CartPageClientProps = {
  /** Payments, shipping, returns and invoices, from the store's settings. */
  terms: PurchaseTerm[];
  shipping: { flat: number; freeFrom: number };
  lowStockThreshold: number;
};

function EmptyCart({ salesMode }: { salesMode: "wholesale" | "retail" }) {
  const saved = useWishlist().length;
  return (
    <main className="commerce-page content-width">
      <EmptyState
        className="cart-empty"
        icon={<ShoppingBag size={26} strokeWidth={1.6} />}
        title="Your cart is empty"
        description={
          salesMode === "wholesale"
            ? "Browse the catalogue to order at wholesale prices, or ask us for a quote on larger volumes."
            : "Browse the catalogue and add the pieces you love."
        }
        action={
          <div className="cart-empty__actions">
            <Button href="/products" icon={<ArrowRight size={16} aria-hidden="true" />}>Browse catalogue</Button>
            {saved > 0 ? (
              <Button href="/wishlist" variant="secondary" icon={<Heart size={16} aria-hidden="true" />}>
                Wishlist ({formatNumber(saved)})
              </Button>
            ) : salesMode === "wholesale" ? (
              <Button href="/request-quote" variant="secondary">Request a quote</Button>
            ) : null}
          </div>
        }
      />
      <RecentlyViewed salesMode={salesMode} />
    </main>
  );
}

export default function CartPageClient({ terms, shipping, lowStockThreshold }: CartPageClientProps) {
  const hydrated = useHydrated();
  const items = useCartItems();
  const { salesMode } = useTenant();
  const feedback = useFeedback();
  const { pricing, linesByKey, error, loading, current, retry } = useCartPricing(items);
  const rows = useMemo(() => cartRows(items, linesByKey), [items, linesByKey]);
  const productIds = useMemo(() => items.map((item) => item.productId), [items]);

  if (!hydrated) return <CartSkeleton />;
  if (items.length === 0) return <EmptyCart salesMode={salesMode} />;

  const pieces = items.reduce((total, item) => total + item.quantity, 0);
  const products = items.length;
  const flagged = rows.filter((row) => row.problem).length;
  const blocked = Boolean(error) || flagged > 0 || (current && (pricing?.issues.length ?? 0) > 0);
  const savings = rows.reduce((total, row) => total + row.saving, 0);
  const updating = loading && pricing !== null;
  const unit = unitLabel(salesMode, pieces);

  const positionOf = (row: CartRow) => items.findIndex((item) => item === row.item);
  const nameOf = (row: CartRow) => row.line?.name ?? "Product";

  function remove(row: CartRow) {
    const index = positionOf(row);
    cartActions.remove(row.item);
    feedback.pushToast({
      type: "info",
      title: "Removed from cart",
      description: nameOf(row),
      actionLabel: "Undo",
      onAction: () => cartActions.restore(row.item, index),
      durationMs: 6000,
    });
  }

  function moveToWishlist(row: CartRow) {
    const index = positionOf(row);
    cartActions.remove(row.item);
    void wishlistActions.add(row.item.productId);
    feedback.pushToast({
      type: "success",
      title: "Moved to your wishlist",
      description: nameOf(row),
      actionLabel: "Undo",
      onAction: () => cartActions.restore(row.item, index),
      durationMs: 6000,
    });
  }

  function clearCart() {
    const snapshot = cartStore.get();
    cartActions.clear();
    feedback.pushToast({
      type: "info",
      title: "Cart cleared",
      description: `${formatNumber(snapshot.length)} ${snapshot.length === 1 ? "product" : "products"} removed.`,
      actionLabel: "Undo",
      onAction: () => cartActions.replace(snapshot),
      durationMs: 8000,
    });
  }

  return (
    <main className="commerce-page content-width cart-page">
      <header className="commerce-heading cart-heading">
        <div>
          <p className="eyebrow">{salesMode === "wholesale" ? "Wholesale order" : "Your order"}</p>
          <h1>Your cart</h1>
          <p className="commerce-heading__meta">
            {formatNumber(products)} {products === 1 ? "product" : "products"} · {formatNumber(pieces)} {unit}
          </p>
        </div>
        <Link className="commerce-heading__link" href="/products">
          <ArrowLeft size={15} aria-hidden="true" /> Continue shopping
        </Link>
      </header>

      {error ? (
        <NoticeCard
          className="cart-notice"
          tone="danger"
          live="alert"
          title="Prices couldn't be updated"
          description={`${error} Your cart is saved; try again in a moment.`}
          action={
            <button type="button" className="notice-link" onClick={retry}>
              Try again
            </button>
          }
        />
      ) : flagged > 0 ? (
        <NoticeCard
          className="cart-notice"
          tone="warning"
          live="status"
          title={flagged === 1 ? "One item needs your attention" : `${formatNumber(flagged)} items need your attention`}
          description="Update or remove the highlighted items to continue to checkout."
        />
      ) : null}

      <div className="cart-layout">
        <section className="cart-items" aria-labelledby="cart-items-title">
          <div className="cart-items__head">
            <h2 id="cart-items-title">Items</h2>
            <button type="button" className="cart-items__clear" onClick={clearCart}>
              Clear cart
            </button>
          </div>
          {rows.map((row, index) => (
            <CartLine
              key={row.key}
              row={row}
              priority={index < 3}
              salesMode={salesMode}
              lowStockThreshold={lowStockThreshold}
              onQuantity={(target, quantity) => cartActions.setQuantity(target.item, quantity)}
              onRemove={remove}
              onSave={moveToWishlist}
            />
          ))}
        </section>

        <CartSummary
          pricing={pricing}
          pieces={pieces}
          salesMode={salesMode}
          savings={savings}
          updating={updating}
          blocked={blocked}
          shipping={shipping}
          terms={terms}
        />
      </div>

      <RecentlyViewed exclude={productIds} salesMode={salesMode} />

      {/* Phones: the total and the way forward stay on screen while the cart scrolls. */}
      <MobileActionBar className="cart-checkout-bar">
        <p className="cart-checkout-bar__total" aria-live="polite">
          <span>
            Total · {formatNumber(pieces)} {unit}
          </span>
          <strong data-updating={updating || undefined}>{pricing ? formatRupees(pricing.totals.totalAmount) : "…"}</strong>
        </p>
        {blocked ? (
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
