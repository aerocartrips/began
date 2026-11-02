import { ProfileSkeleton } from "@/components/ui/loaders/order-list-skeleton";
import PageLoader from "@/components/ui/loaders/page-loader";

export default function AccountLoading() {
  return (
    <main className="commerce-page content-width">
      <PageLoader label="Loading account" />
      <ProfileSkeleton />
    </main>
  );
}
