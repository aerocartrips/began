import Skeleton from "@/components/ui/loaders/Skeleton";

function CartLineSkeleton() {
  return (
    <div className="cart-item ui-skeleton-cart-line">
      <Skeleton className="cart-item-image ui-skeleton-cart-image" rounded="control" />
      <div className="cart-item-details">
        <Skeleton className="ui-skeleton-line ui-skeleton-line--title" />
        <Skeleton className="ui-skeleton-line ui-skeleton-line--meta" />
        <Skeleton className="ui-skeleton-line ui-skeleton-line--button" rounded="control" />
      </div>
    </div>
  );
}

export default function CartSkeleton() {
  return (
    <main className="commerce-page content-width" aria-busy="true" aria-live="polite">
      <Skeleton className="ui-skeleton-line ui-skeleton-line--hero" />
      <div className="cart-layout">
        <section className="cart-items">
          <CartLineSkeleton />
          <CartLineSkeleton />
        </section>
        <Skeleton className="ui-skeleton-panel ui-skeleton-cart-summary" rounded="card" />
      </div>
    </main>
  );
}
