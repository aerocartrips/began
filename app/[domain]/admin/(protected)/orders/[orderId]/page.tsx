import { guardAdminPage } from "@/lib/admin/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import AdminOrderDetailClient from "@/components/admin/admin-order-detail-client";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  await guardAdminPage(PERMISSIONS.ORDERS_MANAGE);
  const { orderId } = await params;
  return <AdminOrderDetailClient orderId={orderId} />;
}
