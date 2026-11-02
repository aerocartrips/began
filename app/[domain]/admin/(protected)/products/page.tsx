import { guardAdminPage } from "@/lib/admin/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import AdminProductListClient from "@/components/admin/product-list-client";

export default async function AdminProductsPage() {
  await guardAdminPage(PERMISSIONS.CATALOG_MANAGE);
  return <AdminProductListClient />;
}