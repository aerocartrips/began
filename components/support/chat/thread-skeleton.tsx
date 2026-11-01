import Skeleton from "@/components/ui/loaders/skeleton";

export function ThreadSkeleton() {
  return (
    <div className="support-thread-skeleton" aria-hidden="true">
      <Skeleton className="support-thread-skeleton__bubble" rounded="card" />
      <Skeleton className="support-thread-skeleton__bubble is-own" rounded="card" />
      <Skeleton className="support-thread-skeleton__bubble is-short" rounded="card" />
    </div>
  );
}

export function ConversationListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="support-list-skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="support-list-skeleton__row">
          <Skeleton className="ui-skeleton-line ui-skeleton-line--title" />
          <Skeleton className="ui-skeleton-line ui-skeleton-line--meta" />
        </div>
      ))}
    </div>
  );
}
