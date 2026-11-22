import ProductForm from "@/components/admin/product-form";
import { loadAdminCatalog } from "@/lib/admin/catalog-data";

export const metadata = { title: "New product | Admin" };

export default async function NewAdminProductPage({ searchParams }: { searchParams: Promise<{ type?: string | string[] }> }) {
  const [catalog, params] = await Promise.all([loadAdminCatalog(), searchParams]);
  const type = Array.isArray(params.type) ? params.type[0] : params.type;
  return <ProductForm catalog={catalog} initialTypeId={type} />;
}
