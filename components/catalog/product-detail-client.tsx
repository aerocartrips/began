"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Share2, ShoppingBag, Zap } from "lucide-react";
import ProductGallery from "@/components/catalog/product-gallery";
import Price from "@/components/catalog/price";
import WishlistButton from "@/components/catalog/wishlist-button";
import MobileActionBar from "@/components/layout/mobile-action-bar";
import QuantitySelector from "@/components/ui/quantity-selector";
import StockAlertButton from "@/features/notifications/components/stock-alert-button";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { cartActions } from "@/features/cart/cart-store";
import { recordProductView } from "@/features/catalog/recently-viewed";
import { MEANINGFUL_VIEW_MS, trackProductActivity } from "@/features/catalog/activity";
import { compareAtPriceFor, unitPriceFor } from "@/lib/catalog/pricing";
import { formatNumber, formatRupees } from "@/lib/format";
import type { ProductDetailData } from "@/features/catalog/types";

type ProductDetailClientProps = {
  product: ProductDetailData;
  salesMode: "wholesale" | "retail";
};

/** Gallery + purchase panel: choosing a colour changes photos, SKU, stock and price. */
export default function ProductDetailClient({ product, salesMode }: ProductDetailClientProps) {
  const { pricing } = product;
  const router = useRouter();
  const feedback = useFeedback();
  const isWholesale = salesMode === "wholesale";
  const defaultVariant = product.variants.find((variant) => variant.stock > 0) ?? product.variants[0] ?? null;
  const [variantId, setVariantId] = useState<string | null>(defaultVariant?.id ?? null);
  const variant = product.variants.find((entry) => entry.id === variantId) ?? null;
  const stock = variant ? variant.stock : product.stock;
  const minimum = product.minimumQuantity;
  const [quantity, setQuantity] = useState(minimum);
  const safeQuantity = Math.max(minimum, Math.min(quantity, Math.max(stock, minimum)));
  const purchasable = stock >= minimum;

  const priced = { ...pricing, bulkPricingTiers: product.tiers };
  const unitPrice = unitPriceFor(priced, safeQuantity, salesMode);
  const compareAt = compareAtPriceFor(priced, salesMode);
  const activeTier = [...product.tiers].reverse().find((tier) => safeQuantity >= tier.minQuantity);
  const images = variant?.images.length ? variant.images : product.images;

  useEffect(() => {
    recordProductView(product.id);
    // Count a view for popularity only once the page has been visible for a few seconds.
    let visibleFor = 0;
    let visibleSince = document.visibilityState === "visible" ? Date.now() : 0;
    let timer: number | undefined;
    const schedule = () => {
      timer = window.setTimeout(() => trackProductActivity(product.id, "view"), Math.max(0, MEANINGFUL_VIEW_MS - visibleFor));
    };
    const onVisibility = () => {
      window.clearTimeout(timer);
      if (document.visibilityState === "visible") {
        visibleSince = Date.now();
        schedule();
      } else if (visibleSince) {
        visibleFor += Date.now() - visibleSince;
        visibleSince = 0;
      }
    };
    if (visibleSince) schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [product.id]);

  const line = { productId: product.id, variantId: variant?.id ?? null, quantity: safeQuantity };

  function addToCart() {
    if (!cartActions.add(line)) {
      feedback.error("Cart unavailable", "Your browser blocked storage, so the cart could not be saved.");
      return;
    }
    feedback.success("Added to cart", `${formatNumber(safeQuantity)} × ${product.name}${variant ? ` (${variant.colorName})` : ""}`);
  }

  function buyNow() {
    if (cartActions.beginBuyNow(line)) router.push("/checkout?intent=buy-now");
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      feedback.success("Link copied", "Share it with anyone.");
    } catch {
      // Share sheet dismissed.
    }
  }

  const quoteHref = `/request-quote?product=${encodeURIComponent(product.slug)}${variant ? `&variant=${variant.id}` : ""}&quantity=${safeQuantity}`;

  return (
    <div className="product-detail-grid">
      <ProductGallery key={variant?.images.length ? variant.id : "product"} images={images} productName={product.name} />

      <div className="product-detail-copy">
        {product.category ? <Link className="product-detail-category" href={`/categories/${product.category.slug}`}>{product.category.name}</Link> : null}
        <h1>{product.name}</h1>
        {product.rating.count > 0 ? (
          <a className="product-detail-rating" href="#product-reviews">
            ★ {product.rating.average.toFixed(1)} · {formatNumber(product.rating.count)} reviews
          </a>
        ) : null}
        {product.shortDescription ? <p className="product-detail-summary">{product.shortDescription}</p> : null}

        <div className="product-detail-price">
          <Price amount={unitPrice} compareAt={compareAt} perPiece={isWholesale} className="catalog-price catalog-price--large" />
          {isWholesale ? (
            <p className="product-detail-note">
              Minimum order {formatNumber(minimum)} pieces · GST extra · Total {formatRupees(unitPrice * safeQuantity)}
            </p>
          ) : (
            <p className="product-detail-note">Inclusive of all charges except GST</p>
          )}
        </div>

        {product.tiers.length > 0 ? (
          <table className="price-tiers">
            <caption>Quantity pricing</caption>
            <thead>
              <tr><th scope="col">Pieces</th><th scope="col">Price per piece</th></tr>
            </thead>
            <tbody>
              <tr className={!activeTier ? "is-active" : undefined}>
                <td>{formatNumber(minimum)}+</td>
                <td>{formatRupees(pricing.wholesalePrice)}</td>
              </tr>
              {product.tiers.map((tier) => (
                <tr key={tier.minQuantity} className={activeTier?.minQuantity === tier.minQuantity ? "is-active" : undefined}>
                  <td>{formatNumber(tier.minQuantity)}+</td>
                  <td>{formatRupees(tier.pricePerUnit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {product.variants.length > 0 ? (
          <fieldset className="variant-picker">
            <legend>Colour: <strong>{variant?.colorName ?? "Choose"}</strong></legend>
            <div role="radiogroup" className="variant-picker__options">
              {product.variants.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  role="radio"
                  aria-checked={entry.id === variantId}
                  aria-label={`${entry.colorName}${entry.stock > 0 ? "" : " (out of stock)"}`}
                  title={entry.colorName}
                  className={`variant-swatch${entry.stock > 0 ? "" : " is-unavailable"}`}
                  style={{ backgroundColor: entry.colorHex }}
                  onClick={() => setVariantId(entry.id)}
                />
              ))}
            </div>
          </fieldset>
        ) : null}

        <p className={`product-stock${purchasable ? "" : " is-out"}`}>
          {purchasable ? `${formatNumber(stock)} in stock` : stock > 0 ? `Only ${formatNumber(stock)} left, below the minimum order` : "Out of stock"}
          {variant ? <span> · SKU {variant.sku}</span> : <span> · SKU {product.sku}</span>}
        </p>

        {purchasable ? (
          <div className="product-purchase">
            <div className="product-purchase__quantity">
              <span className="product-purchase__label" aria-hidden="true">{isWholesale ? "Quantity (pieces)" : "Quantity"}</span>
              <QuantitySelector value={safeQuantity} minimum={minimum} maximum={stock} onChange={setQuantity} />
            </div>
            <button type="button" className="button button-primary product-purchase__action" onClick={addToCart}>
              <ShoppingBag size={16} aria-hidden="true" /> Add to cart
            </button>
            <button type="button" className="button button-glass product-purchase__action" onClick={buyNow}>
              <Zap size={16} aria-hidden="true" /> Buy now
            </button>
          </div>
        ) : (
          <StockAlertButton productId={product.id} />
        )}

        {purchasable ? (
          // Phones: the purchase buttons stay within thumb reach while the shopper scrolls.
          <MobileActionBar className="product-buy-bar">
            <p className="product-buy-bar__price">
              <strong>
                {formatRupees(unitPrice)}
                {isWholesale ? <small>/pc</small> : null}
              </strong>
              <span>
                {isWholesale
                  ? `${formatNumber(safeQuantity)} pcs · ${formatRupees(unitPrice * safeQuantity)}`
                  : compareAt
                    ? <del>{formatRupees(compareAt)}</del>
                    : "Excl. GST"}
              </span>
            </p>
            <button type="button" className="button button-glass" onClick={buyNow}>
              Buy now
            </button>
            <button type="button" className="button button-primary" onClick={addToCart}>
              <ShoppingBag size={16} aria-hidden="true" /> Add to cart
            </button>
          </MobileActionBar>
        ) : null}

        <div className="product-secondary-actions">
          <WishlistButton productId={product.id} productName={product.name} className="wishlist-toggle wishlist-toggle--labelled" showLabel />
          <button type="button" className="text-link" onClick={share}>
            <Share2 size={15} aria-hidden="true" /> Share
          </button>
          {isWholesale ? (
            <Link className="text-link" href={quoteHref}>
              <FileText size={15} aria-hidden="true" /> Request a quote
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
