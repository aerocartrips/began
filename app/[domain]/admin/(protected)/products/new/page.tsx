import ProductForm from "@/components/admin/product-form";
import { requireAdmin } from "@/lib/admin/auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { withCurrentTenant } from "@/lib/tenant/current";

export default async function NewAdminProductPage() {
  await withCurrentTenant(() => requireAdmin(PERMISSIONS.CATALOG_MANAGE));
  return <ProductForm />;
}
