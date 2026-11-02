import ProductCard from "@/components/catalog/product-card";
import type { ProductCardData } from "@/features/catalog/types";

export default function ProductGrid({ products, salesMode, priorityCount = 0, label }: {
  products: ProductCardData[];
  salesMode: "wholesale" | "retail";
  priorityCount?: number;
  label?: string;
}) {
  return (
    <ul className="catalog-grid" aria-label={label}>
      {products.map((product, index) => (
        <li key={product.id}>
          <ProductCard product={product} salesMode={salesMode} priority={index < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
