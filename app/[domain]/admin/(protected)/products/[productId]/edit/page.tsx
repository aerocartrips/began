import { guardAdminPage } from "@/lib/admin/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import EditProductClient from "@/components/admin/edit-product-client";

export default async function EditAdminProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  await guardAdminPage(PERMISSIONS.CATALOG_MANAGE);
  const { productId } = await params;
  return <EditProductClient productId={productId} />;
}