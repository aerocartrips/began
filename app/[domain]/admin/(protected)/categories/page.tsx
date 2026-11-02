import { AdminCategories } from "@/components/admin/admin-catalog-setup-client";
import { guardAdminPage } from "@/lib/admin/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

export const metadata = { title: "Categories | Admin" };

export default async function AdminCategoriesPage() {
  await guardAdminPage(PERMISSIONS.CATALOG_MANAGE);
  return <AdminCategories />;
}
