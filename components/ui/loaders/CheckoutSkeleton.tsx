import Skeleton from "@/components/ui/loaders/Skeleton";

export default function CheckoutSkeleton() {
  return (
    <main className="commerce-page content-width" aria-busy="true" aria-live="polite">
      <Skeleton className="ui-skeleton-line ui-skeleton-line--hero" />
      <div className="checkout-layout">
        <div className="checkout-form">
          <Skeleton className="ui-skeleton-panel" rounded="card" />
          <Skeleton className="ui-skeleton-panel" rounded="card" />
          <Skeleton className="ui-skeleton-line ui-skeleton-line--button" rounded="control" />
        </div>
        <Skeleton className="ui-skeleton-panel ui-skeleton-cart-summary" rounded="card" />
      </div>
    </main>
  );
}
