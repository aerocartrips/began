import Skeleton from "@/components/ui/loaders/Skeleton";

export default function OrderListSkeleton() {
  return (
    <div className="ui-order-list-skeleton" aria-busy="true" aria-live="polite">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="ui-skeleton-panel ui-skeleton-order-row" rounded="card" />
      ))}
    </div>
  );
}

export { OrderListSkeleton };

export function OrderDetailSkeleton() {
  return (
    <main className="commerce-page content-width orders-detail-page" aria-busy="true">
      <Skeleton className="ui-skeleton-line ui-skeleton-line--hero" />
      <Skeleton className="ui-skeleton-panel" rounded="card" />
      <Skeleton className="ui-skeleton-panel" rounded="card" />
    </main>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="checkout-form ui-profile-skeleton" aria-busy="true" aria-live="polite">
      <Skeleton className="ui-skeleton-panel" rounded="card" />
      <Skeleton className="ui-skeleton-line ui-skeleton-line--button" rounded="control" />
    </div>
  );
}
