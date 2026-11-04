import { AdminGuideList } from "@/components/admin/admin-guides-client";
import { guardAdminPage } from "@/lib/admin/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

export const metadata = { title: "Buying guides | Admin" };

export default async function AdminGuidesPage() {
  await guardAdminPage(PERMISSIONS.MARKETING_MANAGE);
  return <AdminGuideList />;
}
