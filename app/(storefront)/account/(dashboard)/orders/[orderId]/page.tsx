import CustomerOrderDetailClient from "@/features/orders/customer-order-detail-client";

export const metadata = {
  title: "Order Details | Norosilk",
};

export default async function AccountOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <CustomerOrderDetailClient orderId={orderId} />;
}
