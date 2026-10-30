"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import Button from "@/components/ui/button";
import { useProductCatalog } from "@/features/products/product-catalog-provider";
import { formatCurrency } from "@/lib/format-currency";
import type { Product } from "@/features/products/types/product";

export default function AdminProductListClient() {
  const { products, deleteProduct } = useProductCatalog();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("name");
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const categories = [...new Set(products.map((product) => product.category))];

  const visibleProducts = products
    .filter((product) => {
      const searchable = `${product.title} ${product.sku} ${product.id} ${product.category}`.toLowerCase();
      return searchable.includes(query.trim().toLowerCase()) &&
        (category === "all" || product.category === category) &&
        (status === "all" || product.status === status);
    })
    .sort((left, right) => {
      if (sort === "price") return left.priceCents - right.priceCents;
      if (sort === "inventory") return left.inventory - right.inventory;
      return left.title.localeCompare(right.title);
    });

  return (
    <>
      <AdminPageHeading
        eyebrow="Catalog"
        title="Products"
        description={`${products.length} sarees in this temporary catalog session.`}
        action={<Button href="/admin/products/new">Add saree</Button>}
      />
      <div className="admin-readonly-notice" role="status">
        Changes are kept in browser memory and reset on refresh. Image selections are preview-only and are not uploaded.
      </div>
      <div className="admin-product-filters">
        <label><span className="sr-only">Search products</span><input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search name, SKU or ID..." /></label>
        <label><span className="sr-only">Filter category</span><select value={category} onChange={(event) => setCategory(event.currentTarget.value)}><option value="all">All categories</option>{categories.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
        <label><span className="sr-only">Filter status</span><select value={status} onChange={(event) => setStatus(event.currentTarget.value)}><option value="all">All statuses</option><option value="published">Published</option><option value="draft">Draft</option></select></label>
        <label><span className="sr-only">Sort products</span><select value={sort} onChange={(event) => setSort(event.currentTarget.value)}><option value="name">Sort: Name</option><option value="price">Sort: Price</option><option value="inventory">Sort: Inventory</option></select></label>
      </div>
      {visibleProducts.length === 0 ? (
        <div className="admin-empty-results" role="status">No sarees match these filters.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th scope="col">Saree</th><th scope="col">SKU</th><th scope="col">Price</th><th scope="col">MOQ</th><th scope="col">Stock</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
            <tbody>
              {visibleProducts.map((product) => (
                <tr key={product.id}>
                  <td><div className="admin-product-cell"><Image src={product.images[0].src} alt="" width={44} height={52} unoptimized /><span><strong>{product.title}</strong><small>{product.category} · {product.saree.weave}</small></span></div></td>
                  <td><code>{product.sku}</code></td>
                  <td>{formatCurrency(product.priceCents, product.currency)}</td>
                  <td>{product.minimumOrderQuantity}</td>
                  <td>{product.inventory.toLocaleString("en-US")}</td>
                  <td><span className={`admin-status-chip ${product.status === "draft" ? "is-draft" : ""}`}>{product.status}</span></td>
                  <td><div className="admin-product-actions">
                    <Link href={`/admin/products/${product.id}/edit`}>Edit</Link>
                    <Link href={`/products/${product.slug}`} >View</Link>
                    {deleteTarget?.id === product.id ? (
                      <span className="admin-delete-confirm"><span>Remove temporarily?</span><button type="button" onClick={() => { deleteProduct(product.id); setDeleteTarget(null); }}>Confirm</button><button type="button" onClick={() => setDeleteTarget(null)}>Cancel</button></span>
                    ) : (
                      <button type="button" onClick={() => setDeleteTarget(product)}>Delete</button>
                    )}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}