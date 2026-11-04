import ProductCard from "@/components/catalog/product-card";
import type { ProductCardData } from "@/features/catalog/types";

const RAIL_SIZES = "(max-width: 640px) 46vw, (max-width: 1100px) 30vw, 20vw";

/** One row of products: swipeable on phones, a single row of up to five on desktop. */
export default function ProductRail({ products, salesMode, label }: {
  products: ProductCardData[];
  salesMode: "wholesale" | "retail";
  label: string;
}) {
  return (
    <ul className="product-rail" aria-label={label}>
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} salesMode={salesMode} sizes={RAIL_SIZES} />
        </li>
      ))}
    </ul>
  );
}
