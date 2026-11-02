import { guardAdminPage } from "@/lib/admin/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import AdminPaymentsClient from "@/components/admin/payments-client";

export default async function AdminPaymentsPage() {
  await guardAdminPage(PERMISSIONS.PAYMENTS_REFUND);
  return <AdminPaymentsClient />;
}
