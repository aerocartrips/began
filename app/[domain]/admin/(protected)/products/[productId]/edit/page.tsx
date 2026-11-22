import { notFound } from "next/navigation";
import ProductForm from "@/components/admin/product-form";
import { loadAdminProduct } from "@/lib/admin/catalog-data";

export const metadata = { title: "Edit product | Admin" };

export default async function EditAdminProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const data = await loadAdminProduct(productId);
  if (!data) notFound();
  const { product, ...catalog } = data;
  // Keyed by save time: after a save (router.refresh) the form starts from the saved product.
  return <ProductForm key={`${product._id}:${product.updatedAt ?? ""}`} catalog={catalog} record={product} />;
}
