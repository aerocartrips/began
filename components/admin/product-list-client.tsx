"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import Button from "@/components/ui/button";
import LoadingButton from "@/components/ui/buttons/LoadingButton";
import ErrorCard from "@/components/ui/feedback/ErrorCard";
import TableSkeleton from "@/components/ui/loaders/TableSkeleton";
import { useApiRequest } from "@/hooks/useApiRequest";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { apiRequest } from "@/lib/api/api-client";
import { formatCurrency } from "@/lib/format-currency";
import {
  mapMongoProductToAdminForm,
  type MongoProductRecord,
} from "@/features/products/admin-product-api";

export default function AdminProductListClient() {
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [status, setStatus] = useState("all");

  const endpoint = useMemo(() => {
    const params = new URLSearchParams({ admin: "true", limit: "100" });
    if (appliedQuery.trim()) params.set("search", appliedQuery.trim());
    if (status === "draft") params.set("status", "draft");
    if (status === "published") params.set("status", "active");
    return `/api/v1/products?${params.toString()}`;
  }, [appliedQuery, status]);

  const { loading, error, data, refetch } = useApiRequest<MongoProductRecord[]>(endpoint);
  const products = (data ?? []).map(mapMongoProductToAdminForm);

  const { run: removeProduct, loading: deleting } = useAsyncAction(async (productId: string) => {
    await apiRequest(`/api/v1/products/${encodeURIComponent(productId)}`, { method: "DELETE" });
    await refetch();
    return null;
  });

  const visibleProducts = products.filter((product) => {
    const searchable = `${product.title} ${product.sku} ${product.category}`.toLowerCase();
    return searchable.includes(query.trim().toLowerCase());
  });

  if (loading && !data) return <TableSkeleton rows={8} />;

  return (
    <>
      <AdminPageHeading
        eyebrow="Catalog"
        title="Products"
        description={`${products.length} sarees saved in MongoDB.`}
        action={<Button href="/admin/products/new">Add saree</Button>}
      />
      {error ? (
        <ErrorCard
          title="Unable to load products"
          description={error}
          action={<LoadingButton onClick={() => void refetch()}>Retry</LoadingButton>}
        />
      ) : null}
      <div className="admin-product-filters">
        <label>
          <span className="sr-only">Search products</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search name, SKU..."
          />
        </label>
        <label>
          <span className="sr-only">Filter status</span>
          <select value={status} onChange={(event) => setStatus(event.currentTarget.value)}>
            <option value="all">All statuses</option>
            <option value="published">Published (active)</option>
            <option value="draft">Draft</option>
          </select>
        </label>
        <LoadingButton type="button" variant="secondary" loading={loading} onClick={() => setAppliedQuery(query)}>
          Apply
        </LoadingButton>
      </div>
      {visibleProducts.length === 0 ? (
        <div className="admin-empty-results" role="status">
          {products.length === 0 ? "No products in the catalog yet." : "No sarees match these filters."}
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Saree</th>
                <th scope="col">SKU</th>
                <th scope="col">Price</th>
                <th scope="col">MOQ</th>
                <th scope="col">Stock</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="admin-product-cell">
                      {product.images[0]?.src ? (
                        <Image src={product.images[0].src} alt="" width={44} height={52} unoptimized />
                      ) : null}
                      <span>
                        <strong>{product.title}</strong>
                        <small>
                          {product.category} · {product.saree.weave}
                        </small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <code>{product.sku}</code>
                  </td>
                  <td>{formatCurrency(product.priceCents, product.currency)}</td>
                  <td>{product.minimumOrderQuantity}</td>
                  <td>{product.inventory.toLocaleString("en-US")}</td>
                  <td>
                    <span className={`admin-status-chip ${product.status === "draft" ? "is-draft" : ""}`}>
                      {product.status}
                    </span>
                  </td>
                  <td>
                    <div className="admin-product-actions">
                      <Link href={`/admin/products/${product.id}/edit`}>Edit</Link>
                      <Link href={`/products/${product.slug}`}>View</Link>
                      <button type="button" disabled={deleting} onClick={() => void removeProduct(product.id)}>
                        Deactivate
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
