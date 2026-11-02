import { guardAdminPage } from "@/lib/admin/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import AdminSettingsClient from "@/components/admin/admin-settings-client";

export default async function AdminSettingsPage() {
  await guardAdminPage(PERMISSIONS.SETTINGS_MANAGE);
  return <AdminSettingsClient />;
}
