import { notFound } from "next/navigation";
import ProductTypeEditor from "@/components/admin/product-type-editor";
import { loadAdminCatalog } from "@/lib/admin/catalog-data";

export const metadata = { title: "Product type | Admin" };

export default async function AdminProductTypePage({ params }: { params: Promise<{ typeId: string }> }) {
  const [{ typeId }, catalog] = await Promise.all([params, loadAdminCatalog()]);
  const type = catalog.types.find((entry) => entry.id === typeId);
  if (!type) notFound();
  // Keyed by save time, so the editor starts from the saved type after router.refresh().
  return <ProductTypeEditor key={String((type as { updatedAt?: string }).updatedAt ?? type.id)} type={type} attributes={catalog.attributes} />;
}
