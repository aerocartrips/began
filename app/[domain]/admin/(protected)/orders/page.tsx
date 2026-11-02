import { guardAdminPage } from "@/lib/admin/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import AdminOrdersClient from "@/components/admin/admin-orders-client";

export default async function AdminOrdersPage() {
  await guardAdminPage(PERMISSIONS.ORDERS_MANAGE);
  return <AdminOrdersClient />;
}
