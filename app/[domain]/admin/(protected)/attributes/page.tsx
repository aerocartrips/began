import { AdminAttributes } from "@/components/admin/admin-catalog-setup-client";
import { guardAdminPage } from "@/lib/admin/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

export const metadata = { title: "Attributes | Admin" };

export default async function AdminAttributesPage() {
  await guardAdminPage(PERMISSIONS.CATALOG_MANAGE);
  return <AdminAttributes />;
}
