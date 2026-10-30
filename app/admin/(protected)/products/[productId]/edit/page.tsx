import EditProductClient from "@/components/admin/edit-product-client";

export default async function EditAdminProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  return <EditProductClient productId={productId} />;
}