import ProductTypesClient from "@/components/admin/product-types-client";
import { loadAdminCatalog } from "@/lib/admin/catalog-data";

export const metadata = { title: "Product types | Admin" };

export default async function AdminProductTypesPage() {
  const { types, untypedCount, templates, attributes, canManageStore } = await loadAdminCatalog();
  return <ProductTypesClient types={types} untypedCount={untypedCount} templates={templates} attributes={attributes} canUpgrade={canManageStore} />;
}
