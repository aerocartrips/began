import Skeleton from "@/components/ui/loaders/skeleton";

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

/** `inline` renders inside an existing layout (e.g. admin) instead of as a storefront page. */
export function OrderDetailSkeleton({ inline = false }: { inline?: boolean }) {
  const content = (
    <>
      <Skeleton className="ui-skeleton-line ui-skeleton-line--hero" />
      <Skeleton className="ui-skeleton-panel" rounded={inline ? "control" : "card"} />
      <Skeleton className="ui-skeleton-panel" rounded={inline ? "control" : "card"} />
    </>
  );
  if (inline) return <div className="ui-detail-skeleton" aria-busy="true">{content}</div>;
  return (
    <main className="commerce-page content-width orders-detail-page ui-detail-skeleton" aria-busy="true">
      {content}
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
