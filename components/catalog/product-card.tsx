import Link from "next/link";
import ProductImage from "@/components/images/product-image";
import Price from "@/components/catalog/price";
import WishlistButton from "@/components/catalog/wishlist-button";
import { formatNumber, formatRupees } from "@/lib/format";
import type { ProductCardData } from "@/features/catalog/types";

type ProductCardProps = {
  product: ProductCardData;
  salesMode: "wholesale" | "retail";
  priority?: boolean;
  /** Image `sizes` hint; rails show narrower cards than grids. */
  sizes?: string;
};

const MAX_SWATCHES = 6;
const GRID_SIZES = "(max-width: 640px) 50vw, (max-width: 1100px) 33vw, 25vw";

export default function ProductCard({ product, salesMode, priority = false, sizes = GRID_SIZES }: ProductCardProps) {
  const href = `/products/${product.slug}`;
  const extraSwatches = product.swatches.length - MAX_SWATCHES;
  const wholesale = salesMode === "wholesale";

  return (
    <article className="catalog-card">
      <div className="catalog-card__media">
        <Link href={href} tabIndex={-1} aria-hidden="true">
          {product.image ? (
            <ProductImage image={product.image} preset="productCard" priority={priority} sizes={sizes} />
          ) : (
            <span className="catalog-card__placeholder" />
          )}
        </Link>
        {product.isNew || product.discountPercent ? (
          <span className="catalog-card__flags">
            {product.isNew ? <span className="catalog-card__flag">New</span> : null}
            {product.discountPercent ? <span className="catalog-card__flag is-offer">{product.discountPercent}% off</span> : null}
          </span>
        ) : null}
        <WishlistButton productId={product.id} productName={product.name} />
        {!product.inStock ? <span className="catalog-card__badge">Out of stock</span> : null}
      </div>
      <div className="catalog-card__body">
        <h3 className="catalog-card__title">
          <Link href={href}>{product.name}</Link>
        </h3>
        {wholesale && product.sku ? <p className="catalog-card__sku">SKU {product.sku}</p> : null}
        {product.swatches.length > 0 ? (
          <ul className="swatch-list" aria-label="Available colours">
            {product.swatches.slice(0, MAX_SWATCHES).map((swatch) => (
              <li key={swatch.id} title={swatch.name}>
                <span className="swatch" style={{ backgroundColor: swatch.hex }} aria-label={swatch.name} />
              </li>
            ))}
            {extraSwatches > 0 ? <li className="swatch-more">+{extraSwatches}</li> : null}
          </ul>
        ) : null}
        <Price amount={product.price} compareAt={product.compareAtPrice} perPiece={wholesale} />
        {wholesale && product.bestTier ? (
          <p className="catalog-card__tier">
            {formatRupees(product.bestTier.pricePerUnit)}/pc from {formatNumber(product.bestTier.minQuantity)} pcs
          </p>
        ) : null}
        <p className="catalog-card__meta">
          {wholesale && product.minimumQuantity > 1 ? <span>MOQ {product.minimumQuantity} pcs</span> : null}
          {product.inStock ? <span className="catalog-card__stock">In stock</span> : null}
          {product.rating.count > 0 ? (
            <span aria-label={`Rated ${product.rating.average.toFixed(1)} out of 5 from ${product.rating.count} reviews`}>
              ★ {product.rating.average.toFixed(1)} ({product.rating.count})
            </span>
          ) : null}
        </p>
      </div>
    </article>
  );
}
