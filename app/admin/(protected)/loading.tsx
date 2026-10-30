import DashboardStatsSkeleton from "@/components/ui/loaders/DashboardStatsSkeleton";
import TableSkeleton from "@/components/ui/loaders/TableSkeleton";

export default function AdminLoading() {
  return (
    <>
      <DashboardStatsSkeleton />
      <TableSkeleton rows={5} />
    </>
  );
}
