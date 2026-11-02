import { guardAdminPage } from "@/lib/admin/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import AdminJobsClient from "@/components/admin/admin-jobs-client";

export default async function AdminJobsPage() {
  await guardAdminPage(PERMISSIONS.JOBS_RUN);
  return <AdminJobsClient />;
}
