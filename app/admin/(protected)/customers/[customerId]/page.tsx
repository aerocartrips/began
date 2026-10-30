import AdminCustomerDetailClient from "@/components/admin/admin-customer-detail-client";

type PageProps = {
  params: Promise<{ customerId: string }>;
};

export default async function AdminCustomerDetailPage({ params }: PageProps) {
  const { customerId } = await params;
  return <AdminCustomerDetailClient customerId={customerId} />;
}
