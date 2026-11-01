import Skeleton from "@/components/ui/loaders/skeleton";

export function AccountShellSkeleton() {
  return (
    <>
      <aside className="account-sidebar" aria-hidden="true">
        <Skeleton className="account-skeleton-identity" rounded="card" />
        <div className="account-skeleton-nav">
          {Array.from({ length: 9 }, (_, index) => (
            <Skeleton key={index} className="account-skeleton-line" />
          ))}
        </div>
      </aside>
      <div className="account-shell-content">
        <AccountSectionSkeleton />
      </div>
    </>
  );
}

export function AccountSectionSkeleton({ panels = 2 }: { panels?: number }) {
  return (
    <div className="account-section-skeleton" role="status" aria-label="Loading account section">
      <Skeleton className="account-skeleton-title" />
      {Array.from({ length: panels }, (_, index) => (
        <Skeleton key={index} className="account-skeleton-panel" rounded="card" />
      ))}
    </div>
  );
}
