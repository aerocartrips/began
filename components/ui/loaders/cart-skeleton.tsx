import Skeleton from "@/components/ui/loaders/skeleton";

/** A cart line still loading (first visit, or a line added in another tab). */
export function CartLineSkeleton() {
  return (
    <div className="cart-line cart-line--loading" aria-hidden="true">
      <Skeleton className="cart-line__media" rounded="control" />
      <div className="cart-line__info">
        <Skeleton className="ui-skeleton-line ui-skeleton-line--title" />
        <Skeleton className="ui-skeleton-line ui-skeleton-line--meta" />
        <Skeleton className="ui-skeleton-line ui-skeleton-line--price" />
      </div>
    </div>
  );
}

/** Placeholder in the cart's own layout, so lines and summary land without shifting. */
export default function CartSkeleton() {
  return (
    <main className="commerce-page content-width cart-page" aria-busy="true">
      <div className="commerce-heading cart-heading">
        <div>
          <Skeleton className="ui-skeleton-line ui-skeleton-line--eyebrow" />
          <Skeleton className="ui-skeleton-line ui-skeleton-line--hero" />
        </div>
      </div>
      <div className="cart-layout">
        <section className="cart-items">
          <CartLineSkeleton />
          <CartLineSkeleton />
        </section>
        <div className="cart-summary">
          <Skeleton className="ui-skeleton-panel ui-skeleton-cart-summary" rounded="card" />
        </div>
      </div>
      <span className="sr-only">Loading your cart</span>
    </main>
  );
}
