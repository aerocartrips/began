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
};

/** Colours shown before "+N": four, so the colours and the rating share one line. */
const MAX_SWATCHES = 4;
/**
 * The card is one size wherever it appears (app/catalog.css, "Product cards"):
 * two columns on small phones, three on large phones, about 160–190px wide from
 * tablets up, in grids and rows alike.
 */
const CARD_SIZES = "(max-width: 540px) 50vw, (max-width: 760px) 30vw, 192px";

/**
 * The store's one product card, used wherever products are listed: home page
 * rows and feed, the catalogue, categories and search, product page rows,
 * recently viewed and the wishlist. Photo, then one line each (the name gets
 * two): name, SKU, price, best quantity price, MOQ and stock, colours and rating.
 */
export default function ProductCard({ product, salesMode, priority = false }: ProductCardProps) {
  const href = `/products/${product.slug}`;
  const wholesale = salesMode === "wholesale";
  const swatches = product.swatches.slice(0, MAX_SWATCHES);
  const extraSwatches = product.swatches.length - swatches.length;
  const moq = wholesale && product.minimumQuantity > 1 ? product.minimumQuantity : 0;
  const rated = product.rating.count > 0;

  return (
    <article className="catalog-card">
      <div className="catalog-card__media">
        <Link href={href} tabIndex={-1} aria-hidden="true">
          {product.image ? (
            <ProductImage image={product.image} preset="productCard" priority={priority} sizes={CARD_SIZES} />
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
        <h3 className="catalog-card__title" title={product.name}>
          <Link href={href}>{product.name}</Link>
        </h3>
        {wholesale && product.sku ? <p className="catalog-card__sku">SKU {product.sku}</p> : null}
        <Price amount={product.price} compareAt={product.compareAtPrice} perPiece={wholesale} />
        {wholesale && product.bestTier ? (
          <p className="catalog-card__tier">
            <span>{formatRupees(product.bestTier.pricePerUnit)}/pc</span> <span>from {formatNumber(product.bestTier.minQuantity)} pcs</span>
          </p>
        ) : null}
        <p className="catalog-card__meta">
          {moq ? <span>MOQ {formatNumber(moq)} pcs</span> : null}
          {product.inStock ? <span className="catalog-card__stock">In stock</span> : null}
        </p>
        {swatches.length > 0 || rated ? (
          <div className="catalog-card__foot">
            {swatches.length > 0 ? (
              <ul className="swatch-list" aria-label="Available colours">
                {swatches.map((swatch) => (
                  <li key={swatch.id} title={swatch.name}>
                    <span className="swatch" style={{ backgroundColor: swatch.hex }} role="img" aria-label={swatch.name} />
                  </li>
                ))}
                {extraSwatches > 0 ? <li className="swatch-more" aria-label={`${extraSwatches} more colours`}>+{extraSwatches}</li> : null}
              </ul>
            ) : null}
            {rated ? (
              <span className="catalog-card__rating" role="img" aria-label={`Rated ${product.rating.average.toFixed(1)} out of 5 from ${product.rating.count} reviews`}>
                ★ {product.rating.average.toFixed(1)} ({product.rating.count})
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
