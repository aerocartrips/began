import { guardAdminPage } from "@/lib/admin/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import AdminCustomersClient from "@/components/admin/admin-customers-client";

export default async function AdminCustomersPage() {
  await guardAdminPage(PERMISSIONS.CUSTOMERS_MANAGE);
  return <AdminCustomersClient />;
}
