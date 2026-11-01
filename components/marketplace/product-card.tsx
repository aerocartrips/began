import Link from "next/link";
import AddToCartButton from "@/components/marketplace/add-to-cart-button";import Badge from "@/components/ui/badge";
import ProductImage from "@/components/images/product-image";
import type { Product } from "@/features/products/types/product";
import { formatCurrency } from "@/lib/format-currency";

type ProductCardProps = {
  product: Product;
  priority?: boolean;
};

export default function ProductCard({ product, priority = false }: ProductCardProps) {
  const available = product.inventory >= product.minimumOrderQuantity;

  return (
    <article className="batch-card product-card">
      <Link className="product-card-image" href={`/products/${product.slug}`}>
        <ProductImage
          image={product.images[0]}
          preset="productCard"
          priority={priority}
          sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
        />
        <span className="product-category">{product.category}</span>
      </Link>
      <div className="batch-info">
        <div className="batch-heading">
          <div>
            <h2><Link href={`/products/${product.slug}`}>{product.title}</Link></h2>
            <p className="batch-origin">{product.details}</p>
            {product.ratingCount && product.ratingCount > 0 ? (
              <p className="product-card-rating">★ {product.ratingAverage?.toFixed(1)} · {product.ratingCount} reviews</p>
            ) : null}
          </div>
          <div className="batch-price">
            <p>{formatCurrency(product.priceCents, product.currency)}<span>/pc</span></p>
            {product.compareAtPriceCents && (
              <del>{formatCurrency(product.compareAtPriceCents, product.currency)}</del>
            )}
          </div>
        </div>
        <div className="product-card-meta">
          <Badge>MOQ: {product.minimumOrderQuantity} Units</Badge>
          <span>{available ? `${product.inventory.toLocaleString("en-US")} in stock` : "Unavailable"}</span>
        </div>
        <AddToCartButton
          productId={product.id}
          quantity={product.minimumOrderQuantity}
          variant="batch"
          disabled={!available}
        />
      </div>
    </article>
  );
}