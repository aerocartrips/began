import Skeleton from "@/components/ui/loaders/skeleton";

export default function DashboardStatsSkeleton() {
  return (
    <div className="admin-stats-grid ui-dashboard-stats-skeleton" aria-busy="true" aria-live="polite">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="ui-skeleton-stat-card" rounded="card" />
      ))}
    </div>
  );
}
