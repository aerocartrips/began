import { ProfileSkeleton } from "@/components/ui/loaders/OrderListSkeleton";
import PageLoader from "@/components/ui/loaders/PageLoader";

export default function AccountLoading() {
  return (
    <main className="commerce-page content-width">
      <PageLoader label="Loading account" />
      <ProfileSkeleton />
    </main>
  );
}
