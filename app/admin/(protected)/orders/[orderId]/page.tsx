import AdminOrderDetailClient from "@/components/admin/admin-order-detail-client";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <AdminOrderDetailClient orderId={orderId} />;
}
