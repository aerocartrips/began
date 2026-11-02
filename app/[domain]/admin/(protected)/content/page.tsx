import { AdminContentList } from "@/components/admin/admin-staff-content-client";
import { guardAdminPage } from "@/lib/admin/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

export const metadata = { title: "Pages | Admin" };

export default async function AdminContentPage() {
  await guardAdminPage(PERMISSIONS.SETTINGS_MANAGE);
  return <AdminContentList />;
}
