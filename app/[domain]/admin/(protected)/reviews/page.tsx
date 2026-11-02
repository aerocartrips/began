import { guardAdminPage } from "@/lib/admin/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import AdminReviewsClient from "@/components/admin/admin-reviews-client";

export default async function AdminReviewsPage() {
  await guardAdminPage(PERMISSIONS.REVIEWS_MODERATE);
  return <AdminReviewsClient />;
}
