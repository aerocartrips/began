import AdminProductListClient from "@/components/admin/product-list-client";
import { loadAdminCatalog } from "@/lib/admin/catalog-data";

export const metadata = { title: "Products | Admin" };

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ type?: string | string[] }> }) {
  const [catalog, params] = await Promise.all([loadAdminCatalog(), searchParams]);
  const type = Array.isArray(params.type) ? params.type[0] : params.type;
  return (
    <AdminProductListClient
      types={catalog.types.map((entry) => ({ id: entry.id, name: entry.pluralName, isActive: entry.isActive }))}
      initialType={type && (type === "none" || catalog.types.some((entry) => entry.id === type)) ? type : ""}
      untypedCount={catalog.untypedCount}
    />
  );
}
