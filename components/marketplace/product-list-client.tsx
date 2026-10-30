"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import EmptyState from "@/components/ui/empty-state";
import ProductCard from "@/components/marketplace/product-card";
import { useProductCatalog } from "@/features/products/product-catalog-provider";

export default function ProductListClient() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") ?? "";
  const { products } = useProductCatalog();
  const [query, setQuery] = useState(initialSearch);
  const [category, setCategory] = useState("all");

  useEffect(() => {
    setQuery(initialSearch); // eslint-disable-line react-hooks/set-state-in-effect -- sync URL search param
  }, [initialSearch]);

  const categories = [...new Set(products.map((product) => product.category))];
  const visibleProducts = useMemo(() => products.filter((product) => {
    const matchesText = `${product.title} ${product.sku} ${product.details} ${product.category} ${product.saree.fabric} ${product.saree.color}`
      .toLowerCase()
      .includes(query.trim().toLowerCase());
    return matchesText && (category === "all" || product.category === category) && product.status === "published";
  }), [category, products, query]);

  return (
    <>
      <div className="store-catalog-controls">
        {initialSearch ? <p className="catalog-search-label">Results for “{initialSearch}” · {visibleProducts.length} item(s)</p> : null}
        <label>
          <span className="sr-only">Search sarees</span>
          <input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search sarees, SKU or weave..." />
        </label>
        <label>
          <span className="sr-only">Filter by category</span>
          <select value={category} onChange={(event) => setCategory(event.currentTarget.value)}>
            <option value="all">All collections</option>
            {categories.map((item) => <option value={item} key={item}>{item}</option>)}
          </select>
        </label>
      </div>
      {visibleProducts.length === 0 ? (
        <EmptyState title="No sarees match your search" description="Try another product name, SKU, or collection." />
      ) : (
        <div className="product-grid">
          {visibleProducts.map((product, index) => (
            <ProductCard product={product} priority={index === 0} key={product.id} />
          ))}
        </div>
      )}
    </>
  );
}