"use client";

import AdminPageHeading from "@/components/admin/admin-page-heading";
import Button from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import ProductForm from "@/components/admin/product-form";
import { useProductCatalog } from "@/features/products/product-catalog-provider";

export default function EditProductClient({ productId }: { productId: string }) {
  const { products } = useProductCatalog();
  const product = products.find((candidate) => candidate.id === productId);

  if (!product) {
    return (
      <EmptyState
        title="Saree not found"
        description="This item may have been removed from the temporary catalog session."
        action={<Button href="/admin/products">Back to products</Button>}
      />
    );
  }

  return <ProductForm key={product.id} product={product} />;
}