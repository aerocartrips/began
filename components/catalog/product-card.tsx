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
  /**
   * `compact` (home page rows and feed, product page rows): the photo plus
   * short lines (one-line name, price, best quantity price) and a row of
   * colours with MOQ and rating, so more products fit on screen. `full`
   * (catalogue listings) adds the SKU, stock and a two-line name.
   */
  variant?: "full" | "compact";
};

const MAX_SWATCHES = { full: 6, compact: 4 } as const;
const GRID_SIZES = "(max-width: 640px) 50vw, (max-width: 1100px) 33vw, 25vw";

export default function ProductCard({ product, salesMode, priority = false, sizes = GRID_SIZES, variant = "full" }: ProductCardProps) {
  const href = `/products/${product.slug}`;
  const compact = variant === "compact";
  const wholesale = salesMode === "wholesale";
  const swatches = product.swatches.slice(0, MAX_SWATCHES[variant]);
  const extraSwatches = product.swatches.length - swatches.length;
  const moq = wholesale && product.minimumQuantity > 1 ? product.minimumQuantity : 0;
  const rating =
    product.rating.count > 0 ? (
      <span aria-label={`Rated ${product.rating.average.toFixed(1)} out of 5 from ${product.rating.count} reviews`}>
        ★ {product.rating.average.toFixed(1)} ({product.rating.count})
      </span>
    ) : null;
  const swatchList =
    swatches.length > 0 ? (
      <ul className="swatch-list" aria-label="Available colours">
        {swatches.map((swatch) => (
          <li key={swatch.id} title={swatch.name}>
            <span className="swatch" style={{ backgroundColor: swatch.hex }} aria-label={swatch.name} />
          </li>
        ))}
        {extraSwatches > 0 ? <li className="swatch-more" aria-label={`${extraSwatches} more colours`}>+{extraSwatches}</li> : null}
      </ul>
    ) : null;

  return (
    <article className={compact ? "catalog-card catalog-card--compact" : "catalog-card"}>
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
        <h3 className="catalog-card__title" title={compact ? product.name : undefined}>
          <Link href={href}>{product.name}</Link>
        </h3>
        {compact ? (
          <>
            <Price amount={product.price} compareAt={product.compareAtPrice} perPiece={wholesale} short />
            {wholesale && product.bestTier ? (
              <p className="catalog-card__tier">
                {formatRupees(product.bestTier.pricePerUnit)}/pc at {formatNumber(product.bestTier.minQuantity)}+
              </p>
            ) : null}
            {swatchList || moq || rating ? (
              <div className="catalog-card__meta">
                {swatchList}
                {moq || rating ? (
                  <span className="catalog-card__facts">
                    {moq ? <span>MOQ {formatNumber(moq)}</span> : null}
                    {rating}
                  </span>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <>
            {wholesale && product.sku ? <p className="catalog-card__sku">SKU {product.sku}</p> : null}
            {swatchList}
            <Price amount={product.price} compareAt={product.compareAtPrice} perPiece={wholesale} />
            {wholesale && product.bestTier ? (
              <p className="catalog-card__tier">
                {formatRupees(product.bestTier.pricePerUnit)}/pc from {formatNumber(product.bestTier.minQuantity)} pcs
              </p>
            ) : null}
            <p className="catalog-card__meta">
              {moq ? <span>MOQ {formatNumber(moq)} pcs</span> : null}
              {product.inStock ? <span className="catalog-card__stock">In stock</span> : null}
              {rating}
            </p>
          </>
        )}
      </div>
    </article>
  );
}
