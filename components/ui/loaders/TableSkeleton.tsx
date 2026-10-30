import Skeleton from "@/components/ui/loaders/Skeleton";

export default function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="admin-table-wrap ui-table-skeleton" aria-busy="true" aria-live="polite">
      <Skeleton className="ui-skeleton-line ui-skeleton-line--title" />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="ui-skeleton-table-row" rounded="control" />
      ))}
    </div>
  );
}
