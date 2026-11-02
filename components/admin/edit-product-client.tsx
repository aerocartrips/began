"use client";

import Button from "@/components/ui/button";
import ErrorCard from "@/components/ui/feedback/error-card";
import LoadingButton from "@/components/ui/buttons/loading-button";
import ProductForm from "@/components/admin/product-form";
import { useApiRequest } from "@/hooks/use-api-request";
import { toDraft, type AdminProductRecord } from "@/features/products/admin-product";

export default function EditProductClient({ productId }: { productId: string }) {
  const { loading, error, data, refetch } = useApiRequest<AdminProductRecord>(`/api/v1/products/${encodeURIComponent(productId)}`);

  if (loading && !data) return <p className="admin-auth-loading" role="status">Loading product…</p>;

  if (error || !data) {
    return (
      <ErrorCard
        title="Product unavailable"
        description={error || "This product could not be loaded."}
        action={
          <>
            <LoadingButton type="button" onClick={() => void refetch()}>Retry</LoadingButton>
            <Button href="/admin/products" variant="secondary">Back to products</Button>
          </>
        }
      />
    );
  }

  return <ProductForm key={`${data._id}:${data.updatedAt ?? ""}`} initial={toDraft(data)} />;
}
