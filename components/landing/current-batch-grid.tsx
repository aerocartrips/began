"use client";

import BatchCard from "@/components/marketplace/batch-card";
import { useProductCatalog } from "@/features/products/product-catalog-provider";

export default function CurrentBatchGrid() {
  const { products } = useProductCatalog();
  const publishedProducts = products.filter((product) => product.status === "published");

  return (
    <div className="batch-grid">
      {publishedProducts.map((product) => <BatchCard batch={product} key={product.id} />)}
    </div>
  );
}