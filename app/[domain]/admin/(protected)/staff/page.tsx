import { AdminStaff } from "@/components/admin/admin-staff-content-client";
import { guardAdminPage } from "@/lib/admin/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

export const metadata = { title: "Staff | Admin" };

export default async function AdminStaffPage() {
  await guardAdminPage(PERMISSIONS.STAFF_MANAGE);
  return <AdminStaff />;
}
