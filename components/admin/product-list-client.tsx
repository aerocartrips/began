"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState, type FormEvent } from "react";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import AdminStatusChip from "@/components/admin/admin-status-chip";
import Button from "@/components/ui/button";
import LoadingButton from "@/components/ui/buttons/loading-button";
import ErrorCard from "@/components/ui/feedback/error-card";
import Select, { toSelectOptions } from "@/components/ui/form/select";
import TableSkeleton from "@/components/ui/loaders/table-skeleton";
import { useApiRequest } from "@/hooks/use-api-request";
import { useAsyncAction } from "@/hooks/use-async-action";
import { apiRequest } from "@/lib/api/api-client";
import { formatNumber, formatRupees } from "@/lib/format";
import { useTenant } from "@/features/tenant/tenant-provider";
import type { AdminProductRecord } from "@/features/products/admin-product";

const PAGE_SIZE = 25;
const STATUS_FILTER_OPTIONS = toSelectOptions([
  ["", "All statuses"],
  ["active", "Active"],
  ["draft", "Draft"],
  ["inactive", "Inactive"],
]);
const STOCK_FILTER_OPTIONS = toSelectOptions([
  ["", "Any stock"],
  ["in_stock", "In stock"],
  ["out_of_stock", "Out of stock"],
]);

type ListFilters = { search: string; status: string; stock: string; type: string; page: number };

export type ListTypeOption = { id: string; name: string; isActive: boolean };

/** Server-paginated product table; scales to stores with tens of thousands of products. */
export default function AdminProductListClient({ types, initialType = "", untypedCount = 0 }: {
  /** The store's product types, for the type filter. */
  types: ListTypeOption[];
  /** Type to filter by on arrival (/admin/products?type=…). */
  initialType?: string;
  untypedCount?: number;
}) {
  const { salesMode } = useTenant();
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState<ListFilters>({ search: "", status: "", stock: "", type: initialType, page: 1 });
  const typeOptions = [
    { id: "", label: "All types" },
    ...types.map((type) => ({ id: type.id, label: `${type.name}${type.isActive ? "" : " (off)"}` })),
    ...(untypedCount ? [{ id: "none", label: "Without a type" }] : []),
  ];
  const newHref = filters.type && filters.type !== "none" ? `/admin/products/new?type=${filters.type}` : "/admin/products/new";

  const endpoint = useMemo(() => {
    const params = new URLSearchParams({ admin: "true", limit: String(PAGE_SIZE), page: String(filters.page) });
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    if (filters.stock) params.set("availability", filters.stock);
    if (filters.type) params.set("type", filters.type);
    return `/api/v1/products?${params}`;
  }, [filters]);

  const { loading, error, data, meta, refetch } = useApiRequest<AdminProductRecord[]>(endpoint);
  const total = Number(meta?.total ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const { run: deactivate, loading: deactivating } = useAsyncAction(async (productId: string) => {
    await apiRequest(`/api/v1/products/${encodeURIComponent(productId)}`, { method: "DELETE" });
    await refetch();
    return null;
  });

  function applySearch(event: FormEvent) {
    event.preventDefault();
    setFilters((current) => ({ ...current, search: searchInput.trim(), page: 1 }));
  }

  return (
    <>
      <AdminPageHeading
        eyebrow="Catalogue"
        title="Products"
        description={`${formatNumber(total)} products`}
        action={<Button href={newHref}>Add product</Button>}
      />
      {error ? (
        <ErrorCard title="Unable to load products" description={error} action={<LoadingButton onClick={() => void refetch()}>Retry</LoadingButton>} />
      ) : null}
      <form className="admin-product-filters" onSubmit={applySearch} role="search">
        <label>
          <span className="sr-only">Search products</span>
          <input value={searchInput} onChange={(event) => setSearchInput(event.currentTarget.value)} placeholder="Search name, SKU, details…" />
        </label>
        <Select
          label="Filter by status"
          hideLabel
          options={STATUS_FILTER_OPTIONS}
          value={filters.status}
          onChange={(status) => setFilters({ ...filters, status, page: 1 })}
        />
        {types.length > 1 || untypedCount ? (
          <Select
            label="Filter by type"
            hideLabel
            options={typeOptions}
            value={filters.type}
            onChange={(type) => setFilters({ ...filters, type, page: 1 })}
          />
        ) : null}
        <Select
          label="Filter by stock"
          hideLabel
          options={STOCK_FILTER_OPTIONS}
          value={filters.stock}
          onChange={(stock) => setFilters({ ...filters, stock, page: 1 })}
        />
        <LoadingButton type="submit" variant="secondary" size="sm" loading={loading}>Search</LoadingButton>
      </form>

      {loading && !data ? (
        <TableSkeleton rows={8} />
      ) : (data ?? []).length === 0 ? (
        <div className="admin-empty-results" role="status">
          {filters.search || filters.status || filters.stock || filters.type ? "No products match these filters." : "No products yet."}
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">SKU</th>
                <th scope="col" className="is-numeric">{salesMode === "wholesale" ? "Wholesale" : "Price"}</th>
                {salesMode === "wholesale" ? <th scope="col" className="is-numeric">MOQ</th> : null}
                <th scope="col" className="is-numeric">Stock</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((product) => {
                const image = product.images?.[0] ?? product.colorMedia?.[0]?.images?.[0] ?? product.variants?.[0]?.images?.[0];
                const category = typeof product.category === "object" ? product.category?.name : "";
                const type = product.productType && typeof product.productType === "object" ? product.productType : null;
                const variantCount = product.variants?.length ?? 0;
                return (
                  <tr key={product._id}>
                    <td>
                      <div className="admin-product-cell">
                        {image ? <Image src={image.secureUrl || image.url || ""} alt="" width={44} height={52} /> : null}
                        <span>
                          <strong>{product.name}</strong>
                          <small>
                            {[type?.name ?? "No type", category, variantCount ? `${variantCount} variants` : "", product.sizeRange ? `sizes ${product.sizeRange}` : ""]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td><code>{product.sku}</code></td>
                    <td className="is-numeric">{formatRupees(salesMode === "wholesale" ? product.wholesalePrice : product.price)}</td>
                    {salesMode === "wholesale" ? <td className="is-numeric">{formatNumber(product.minimumOrderQuantity)}</td> : null}
                    <td className="is-numeric">{formatNumber(product.stockQuantity)}</td>
                    <td>
                      <AdminStatusChip status={product.status ?? "draft"} />
                      {product.typeHidden ? <AdminStatusChip status="inactive" tone="warning" label="Type off" /> : null}
                    </td>
                    <td>
                      <div className="admin-product-actions">
                        <Link href={`/admin/products/${product._id}/edit`}>Edit</Link>
                        {product.status === "active" ? <Link href={`/products/${product.slug}`} target="_blank">View</Link> : null}
                        {product.status !== "inactive" ? (
                          <button type="button" disabled={deactivating} onClick={() => void deactivate(product._id)}>Deactivate</button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 ? (
        <nav className="catalog-pagination" aria-label="Product pages">
          <button type="button" disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Previous</button>
          <span aria-current="page">Page {filters.page} of {pageCount}</span>
          <button type="button" disabled={filters.page >= pageCount} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Next</button>
        </nav>
      ) : null}
    </>
  );
}
