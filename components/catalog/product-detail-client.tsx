"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Share2, ShoppingBag, Zap } from "lucide-react";
import ProductGallery from "@/components/catalog/product-gallery";
import Price from "@/components/catalog/price";
import PurchaseTermsList from "@/components/catalog/purchase-terms-list";
import SizeGuide from "@/components/catalog/size-guide";
import WishlistButton from "@/components/catalog/wishlist-button";
import MobileActionBar from "@/components/layout/mobile-action-bar";
import RatingStars from "@/components/reviews/rating-stars";
import QuantitySelector from "@/components/ui/quantity-selector";
import StockAlertButton from "@/features/notifications/components/stock-alert-button";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { cartActions } from "@/features/cart/cart-store";
import { recordProductView } from "@/features/catalog/recently-viewed";
import { MEANINGFUL_VIEW_MS, trackProductActivity } from "@/features/catalog/activity";
import { compareAtPriceFor, unitPriceFor } from "@/lib/catalog/pricing";
import { SKU_PARAM, variantFromParams, variantParamValues } from "@/lib/catalog/variant-url";
import { formatNumber, formatRupees } from "@/lib/format";
import type { PurchaseTerm } from "@/lib/catalog/purchase-terms";
import type { CatalogImage, ProductDetailData, ProductOptionData, ProductVariantData } from "@/features/catalog/types";

type ProductDetailClientProps = {
  product: ProductDetailData;
  salesMode: "wholesale" | "retail";
  /** "Only N left" shows at or below this stock (Admin → Settings). */
  lowStockThreshold: number;
  /** Payments, shipping and returns, from the store's settings. */
  terms: PurchaseTerm[];
};

type Selection = Record<string, string>;

const photoKey = (image: CatalogImage) => image.publicId ?? image.url;

/** A colour's own photos first, then the product's shared photos, so detail shots stay one swipe away. */
function photosFor(product: ProductDetailData, variant: ProductVariantData | null) {
  if (!variant?.images.length) return product.images;
  const own = new Set(variant.images.map(photoKey));
  return [...variant.images, ...product.images.filter((image) => !own.has(photoKey(image)))];
}

const percentOff = (price: number, base: number) => (base > price && base > 0 ? Math.round((1 - price / base) * 100) : 0);

/** The page address's query (empty while server rendering and hydrating). */
const subscribeToHistory = (onChange: () => void) => {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
};
const currentSearch = () => window.location.search;
const noSearch = () => "";

/** Whether `variant` has every value in `selection` (keys it lacks don't count against it). */
const matches = (variant: ProductVariantData, selection: Selection, except?: string) =>
  Object.entries(selection).every(([key, value]) => key === except || !(key in variant.options) || variant.options[key] === value);

/**
 * Gallery + purchase panel. Shoppers pick each option (colour swatches, size
 * chips with the size guide, other chips); the combination is a variant with
 * its own photos, SKU and stock, and its own address (?color=red&size=m), so
 * shared links and search results open on it.
 */
export default function ProductDetailClient({ product, salesMode, lowStockThreshold, terms }: ProductDetailClientProps) {
  const { pricing } = product;
  const router = useRouter();
  const feedback = useFeedback();
  const isWholesale = salesMode === "wholesale";
  const minimum = product.minimumQuantity;
  const purchasableVariant = (variant: ProductVariantData) => variant.stock >= minimum;
  const defaultVariant = product.variants.find(purchasableVariant) ?? product.variants[0] ?? null;
  const linkedVariant = variantFromParams(product.variants, useSyncExternalStore(subscribeToHistory, currentSearch, noSearch));
  const [pickedId, setPickedId] = useState<string | null>(null);
  const variant = product.variants.find((entry) => entry.id === pickedId) ?? linkedVariant ?? defaultVariant ?? null;
  const selection: Selection = variant?.options ?? {};
  const stock = variant ? variant.stock : product.stock;
  const [quantity, setQuantity] = useState(minimum);
  const safeQuantity = Math.max(minimum, Math.min(quantity, Math.max(stock, minimum)));
  const purchasable = stock >= minimum;
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const priced = { ...pricing, bulkPricingTiers: product.tiers };
  const unitPrice = unitPriceFor(priced, safeQuantity, salesMode);
  const compareAt = compareAtPriceFor(priced, salesMode);
  const basePrice = unitPriceFor(priced, minimum, salesMode);
  // The first break is the price at the minimum order; the rest are the quantity tiers above it.
  const breaks = [{ minQuantity: minimum, pricePerUnit: basePrice }, ...product.tiers.filter((tier) => tier.minQuantity > minimum)];
  const activeBreak = breaks.findLast((tier) => safeQuantity >= tier.minQuantity) ?? breaks[0];
  const images = photosFor(product, variant);
  const lineTotal = unitPrice * safeQuantity;

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
    feedback.success("Added to cart", `${formatNumber(safeQuantity)} × ${product.name}${variant?.title ? ` (${variant.title})` : ""}`);
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

  /** Shows a variant and gives the address its parameters (no navigation, no new history entry). */
  function showVariant(next: ProductVariantData) {
    setPickedId(next.id);
    const params = variantParamValues(product.variants).get(next.id) ?? {};
    const url = new URL(window.location.href);
    for (const option of product.options) url.searchParams.delete(option.key);
    url.searchParams.delete(SKU_PARAM);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    // Next.js keeps its router in step with replaceState.
    window.history.replaceState(null, "", url);
  }

  /**
   * Picks `value` for one option, keeping the other choices when that
   * combination exists, else switching to the closest variant that has it
   * (one in stock first), so the selection always names a real variant.
   */
  function choose(key: string, value: string) {
    const wanted = { ...selection, [key]: value };
    const candidates = product.variants.filter((entry) => entry.options[key] === value);
    const exact = candidates.find((entry) => matches(entry, wanted));
    const next =
      exact ??
      candidates.find((entry) => purchasableVariant(entry) && matches(entry, wanted, key)) ??
      candidates.find(purchasableVariant) ??
      candidates[0];
    if (next) showVariant(next);
  }

  /** For each value of an option, given the other choices: does that combination exist, and can it be ordered? */
  function valueState(option: ProductOptionData, value: string) {
    const combos = product.variants.filter((entry) => entry.options[option.key] === value && matches(entry, selection, option.key));
    return { exists: combos.length > 0, available: combos.some(purchasableVariant), stock: combos.reduce((total, entry) => Math.max(total, entry.stock), 0) };
  }

  /** Radio group keys: arrows move the selection, as in a native radio group. */
  function onGroupKey(event: KeyboardEvent<HTMLDivElement>, option: ProductOptionData) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step || option.values.length < 2) return;
    event.preventDefault();
    const current = Math.max(0, option.values.findIndex((entry) => entry.value === selection[option.key]));
    const next = (current + step + option.values.length) % option.values.length;
    choose(option.key, option.values[next].value);
    groupRefs.current[option.key]?.querySelectorAll<HTMLButtonElement>("[role=radio]")[next]?.focus();
  }

  const stockLabel = purchasable
    ? stock <= lowStockThreshold
      ? `Only ${formatNumber(stock)} left`
      : isWholesale
        ? `In stock · ${formatNumber(stock)} pieces available`
        : "In stock"
    : stock > 0
      ? `Only ${formatNumber(stock)} left, below the minimum order of ${formatNumber(minimum)}`
      : "Out of stock";
  const stockTone = !purchasable ? "is-out" : stock <= lowStockThreshold ? "is-low" : "";
  const quoteHref = `/request-quote?product=${encodeURIComponent(product.slug)}${variant ? `&variant=${variant.id}` : ""}&quantity=${safeQuantity}`;
  const discount = compareAt ? percentOff(unitPrice, compareAt) : 0;

  return (
    <div className="product-detail-grid" data-photos={images.length > 1 ? "many" : "one"}>
      {/* Keyed by colour: a new size keeps the gallery where it was; a new colour shows its photos. */}
      <ProductGallery key={variant?.images.length ? variant.colorName || variant.id : "product"} images={images} productName={product.name} />

      <div className="product-detail-copy">
        <header className="product-detail-head">
          {product.category || product.isNew ? (
            <p className="product-detail-eyebrow">
              {product.category ? <Link href={`/categories/${product.category.slug}`}>{product.category.name}</Link> : null}
              {product.isNew ? <span className="product-detail-badge">New</span> : null}
            </p>
          ) : null}
          <h1>{product.name}</h1>
          <div className="product-detail-meta">
            {product.rating.count > 0 ? (
              <a className="product-detail-rating" href="#product-reviews">
                <RatingStars value={product.rating.average} size="sm" />
                <span>
                  <strong>{product.rating.average.toFixed(1)}</strong> ({formatNumber(product.rating.count)}{" "}
                  {product.rating.count === 1 ? "review" : "reviews"})
                </span>
              </a>
            ) : null}
            <span className="product-detail-sku">SKU {variant?.sku || product.sku}</span>
          </div>
          {product.shortDescription ? <p className="product-detail-summary">{product.shortDescription}</p> : null}
        </header>

        <div className="product-detail-price">
          <div className="product-detail-price__row">
            <Price amount={unitPrice} compareAt={compareAt} perPiece={isWholesale} className="catalog-price catalog-price--large" />
            {discount > 0 ? <span className="product-detail-badge product-detail-badge--offer">{discount}% off</span> : null}
          </div>
          <p className="product-detail-note">
            {isWholesale ? `Minimum order ${formatNumber(minimum)} ${minimum === 1 ? "piece" : "pieces"} · GST extra` : "GST extra, added at checkout"}
          </p>
        </div>

        {breaks.length > 1 ? (
          <fieldset className="price-tiers">
            <legend>Quantity pricing</legend>
            <div className="price-tiers__options">
              {breaks.map((tier) => {
                const reachable = tier.minQuantity <= stock;
                const saving = percentOff(tier.pricePerUnit, basePrice);
                return (
                  <button
                    key={tier.minQuantity}
                    type="button"
                    className="price-tier"
                    aria-pressed={tier === activeBreak}
                    disabled={!reachable}
                    title={reachable ? undefined : `Only ${formatNumber(stock)} in stock`}
                    onClick={() => setQuantity(tier.minQuantity)}
                  >
                    <span className="price-tier__qty">{formatNumber(tier.minQuantity)}+ pcs</span>
                    <strong>{formatRupees(tier.pricePerUnit)}</strong>
                    <span className="price-tier__note">{saving > 0 ? `Save ${saving}%` : "Per piece"}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        {product.options.map((option) => {
          const chosen = selection[option.key];
          const chosenState = chosen ? valueState(option, chosen) : null;
          const guide = option.kind === "size" ? product.sizeChart : null;
          return (
            // The size guide sits on the option's name line, beside the fieldset rather than inside its legend.
            <div key={option.key} className={guide ? "variant-option has-guide" : "variant-option"}>
              {guide ? (
                <SizeGuide
                  chart={guide}
                  optionName={option.name}
                  sizes={option.values.map((entry) => entry.value)}
                  selected={chosen}
                  onSelect={(size) => choose(option.key, size)}
                />
              ) : null}
              <fieldset className="variant-picker">
                <legend>
                  {option.name}: <strong>{chosen ?? "Choose"}</strong>
                  {chosenState && !chosenState.available ? <span className="variant-picker__status"> · Out of stock</span> : null}
                </legend>
                <div
                  ref={(node) => {
                    groupRefs.current[option.key] = node;
                  }}
                  role="radiogroup"
                  aria-label={option.name}
                  className={option.kind === "color" ? "variant-picker__options" : "variant-picker__options variant-picker__options--chips"}
                  onKeyDown={(event) => onGroupKey(event, option)}
                >
                  {option.values.map((entry, index) => {
                    const selected = entry.value === chosen;
                    const state = valueState(option, entry.value);
                    const unavailable = !state.available;
                    const label = `${entry.value}${state.exists ? (unavailable ? " (out of stock)" : "") : " (not in this combination)"}`;
                    const common = {
                      type: "button" as const,
                      role: "radio",
                      "aria-checked": selected,
                      tabIndex: selected || (!chosen && index === 0) ? 0 : -1,
                      title: label,
                      onClick: () => choose(option.key, entry.value),
                    };
                    return option.kind === "color" ? (
                      <button key={entry.value} {...common} aria-label={label} className={`variant-swatch${unavailable ? " is-unavailable" : ""}`}>
                        <span style={{ backgroundColor: entry.hex || undefined }} />
                      </button>
                    ) : (
                      <button key={entry.value} {...common} aria-label={label} className={`option-chip${unavailable ? " is-unavailable" : ""}`}>
                        {entry.value}
                        {state.available && state.stock <= lowStockThreshold ? <small className="option-chip__note">{formatNumber(state.stock)} left</small> : null}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          );
        })}

        <div className="product-purchase-panel">
          <p className={`product-stock ${stockTone}`.trim()} role="status">
            <span className="product-stock__dot" aria-hidden="true" />
            {stockLabel}
          </p>
          {purchasable ? (
            <>
              <div className="product-purchase">
                <div className="product-purchase__quantity">
                  <span className="product-purchase__label" aria-hidden="true">{isWholesale ? "Quantity (pieces)" : "Quantity"}</span>
                  <QuantitySelector value={safeQuantity} minimum={minimum} maximum={stock} onChange={setQuantity} />
                </div>
                <button type="button" className="button button-primary product-purchase__action" onClick={addToCart}>
                  <ShoppingBag size={17} aria-hidden="true" /> Add to cart
                </button>
                <button type="button" className="button product-purchase__action product-purchase__buy" onClick={buyNow}>
                  <Zap size={17} aria-hidden="true" /> Buy now
                </button>
              </div>
              {isWholesale || safeQuantity > 1 ? (
                <p className="product-purchase__total">
                  <span>Order total</span>
                  <strong>{formatRupees(lineTotal)}</strong>
                  <small>
                    {formatNumber(safeQuantity)} {isWholesale ? (safeQuantity === 1 ? "piece" : "pieces") : safeQuantity === 1 ? "item" : "items"} × {formatRupees(unitPrice)} · GST extra
                  </small>
                </p>
              ) : null}
            </>
          ) : (
            // Shoppers wait for the size or colour they picked, not the whole product.
            <StockAlertButton
              key={variant?.id ?? "product"}
              productId={product.id}
              variantId={product.variants.length > 1 ? variant?.id ?? null : null}
              variantTitle={product.variants.length > 1 ? variant?.title ?? "" : ""}
            />
          )}
        </div>

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
                  ? `${formatNumber(safeQuantity)} pcs · ${formatRupees(lineTotal)}`
                  : compareAt
                    ? <del>{formatRupees(compareAt)}</del>
                    : variant?.title || "GST extra"}
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
          <WishlistButton productId={product.id} productName={product.name} className="product-action" showLabel />
          <button type="button" className="product-action" onClick={share}>
            <Share2 size={16} aria-hidden="true" /> Share
          </button>
          {isWholesale ? (
            <Link className="product-action" href={quoteHref}>
              <FileText size={16} aria-hidden="true" /> Request a quote
            </Link>
          ) : null}
        </div>

        <PurchaseTermsList terms={terms} label="Payment, shipping and returns" className="purchase-terms--compact" />
      </div>
    </div>
  );
}
