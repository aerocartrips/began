import { guardAdminPage } from "@/lib/admin/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import AdminReturnsClient from "@/components/admin/admin-returns-client";

export default async function AdminReturnsPage() {
  await guardAdminPage(PERMISSIONS.RETURNS_MANAGE);
  return <AdminReturnsClient />;
}
