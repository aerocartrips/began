import DashboardStatsSkeleton from "@/components/ui/loaders/dashboard-stats-skeleton";
import TableSkeleton from "@/components/ui/loaders/table-skeleton";

export default function AdminLoading() {
  return (
    <>
      <DashboardStatsSkeleton />
      <TableSkeleton rows={5} />
    </>
  );
}
