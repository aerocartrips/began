import { guardAdminPage } from "@/lib/admin/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import AdminCustomerDetailClient from "@/components/admin/admin-customer-detail-client";

type PageProps = {
  params: Promise<{ customerId: string }>;
};

export default async function AdminCustomerDetailPage({ params }: PageProps) {
  await guardAdminPage(PERMISSIONS.CUSTOMERS_MANAGE);
  const { customerId } = await params;
  return <AdminCustomerDetailClient customerId={customerId} />;
}
