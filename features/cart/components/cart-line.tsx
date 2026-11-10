"use client";

import Link from "next/link";
import { AlertCircle, Heart, PackageX, Trash2, TrendingDown } from "lucide-react";
import ProductImage from "@/components/images/product-image";
import QuantitySelector from "@/components/ui/quantity-selector";
import { CartLineSkeleton } from "@/components/ui/loaders/cart-skeleton";
import { lineProblemText, problemFix, unitLabel, type CartRow } from "@/features/cart/cart-rows";
import { formatNumber, formatRupees } from "@/lib/format";

type CartLineProps = {
  row: CartRow;
  salesMode: "wholesale" | "retail";
  /** "Only N left" shows at or below this stock (store setting). */
  lowStockThreshold: number;
  onQuantity: (row: CartRow, quantity: number) => void;
  onRemove: (row: CartRow) => void;
  onSave: (row: CartRow) => void;
  /** Above the fold on arrival: load the photo first. */
  priority?: boolean;
};

/**
 * One cart line. The quantity comes from the cart itself, so steps register
 * at once (and add up when tapped quickly); prices follow the same tier rule
 * as the server. Problems (minimum order, stock, a withdrawn product) show on
 * the line with the fix next to them.
 */
export default function CartLine({ row, salesMode, lowStockThreshold, onQuantity, onRemove, onSave, priority = false }: CartLineProps) {
  const { line, item, problem } = row;
  if (!line) return <CartLineSkeleton />;

  const remove = (
    <button type="button" className="cart-line__action" onClick={() => onRemove(row)}>
      <Trash2 size={15} aria-hidden="true" /> Remove
    </button>
  );

  if (line.unavailable) {
    return (
      <article className="cart-line cart-line--unavailable" data-problem="">
        <span className="cart-line__media cart-line__media--empty" aria-hidden="true">
          <PackageX size={22} strokeWidth={1.6} />
        </span>
        <div className="cart-line__info">
          <h3 className="cart-line__name">Product unavailable</h3>
          <p className="cart-line__problem">
            <AlertCircle size={15} aria-hidden="true" /> {lineProblemText({ kind: "unavailable" }, "")}
          </p>
        </div>
        <div className="cart-line__actions">{remove}</div>
      </article>
    );
  }

  const name = line.name ?? "Product";
  const href = `/products/${line.slug}`;
  const minimum = line.minimumQuantity ?? 1;
  const available = line.available ?? 0;
  const unit = unitLabel(salesMode, 2);
  const perUnit = salesMode === "wholesale" ? "/ piece" : "each";
  const bulkPrice = row.unitPrice < row.basePrice;
  const wasPrice = bulkPrice ? row.basePrice : (line.compareAtPrice ?? 0) > row.unitPrice ? line.compareAtPrice : null;
  const fix = problem ? problemFix(problem) : null;
  const locked = problem?.kind === "soldOut" || problem?.kind === "colour";
  const lowStock = !problem && available <= lowStockThreshold;

  return (
    <article className="cart-line" data-problem={problem ? "" : undefined}>
      <Link href={href} className="cart-line__media" tabIndex={-1} aria-hidden="true">
        {line.imagePublicId || line.imageUrl ? (
          <ProductImage image={{ publicId: line.imagePublicId, url: line.imageUrl, alt: name }} preset="thumbnail" sizes="104px" priority={priority} />
        ) : null}
      </Link>

      <div className="cart-line__info">
        <h3 className="cart-line__name">
          <Link href={href}>{name}</Link>
        </h3>
        <p className="cart-line__meta">
          {line.colorName ? (
            <span className="cart-line__colour">
              <span className="swatch" style={{ backgroundColor: line.colorHex || undefined }} aria-hidden="true" />
              {line.colorName}
            </span>
          ) : null}
          {line.sku ? <span>SKU {line.sku}</span> : null}
        </p>
        <p className="cart-line__price">
          <strong>{formatRupees(row.unitPrice)}</strong> <span>{perUnit}</span>
          {wasPrice ? <s aria-label={`was ${formatRupees(wasPrice)}`}>{formatRupees(wasPrice)}</s> : null}
          {bulkPrice ? <span className="cart-line__badge">Bulk price</span> : null}
        </p>

        {problem ? (
          <p className="cart-line__problem" role="alert">
            <AlertCircle size={15} aria-hidden="true" />
            <span>{lineProblemText(problem, unit)}</span>
            {fix !== null ? (
              <button type="button" className="cart-line__fix" onClick={() => onQuantity(row, fix)}>
                Update to {formatNumber(fix)}
              </button>
            ) : problem.kind === "colour" ? (
              <Link className="cart-line__fix" href={href}>Choose a colour</Link>
            ) : null}
          </p>
        ) : row.nextTier ? (
          <p className="cart-line__hint">
            <TrendingDown size={15} aria-hidden="true" />
            <span>
              Buy {formatNumber(row.nextTier.minQuantity)}+ at <strong>{formatRupees(row.nextTier.pricePerUnit)}</strong> {perUnit}
            </span>
            <button type="button" className="cart-line__fix" onClick={() => onQuantity(row, row.nextTier?.minQuantity ?? item.quantity)}>
              Add {formatNumber(row.nextTier.minQuantity - item.quantity)} more
            </button>
          </p>
        ) : lowStock ? (
          <p className="cart-line__stock">Only {formatNumber(available)} left</p>
        ) : null}
      </div>

      <div className="cart-line__quantity">
        <QuantitySelector
          value={item.quantity}
          minimum={minimum}
          maximum={Math.max(available, minimum)}
          disabled={locked}
          label={name}
          onChange={(quantity) => onQuantity(row, quantity)}
        />
        {minimum > 1 ? <small>Min. {formatNumber(minimum)} {unit}</small> : null}
      </div>

      <div className="cart-line__total">
        <strong>{formatRupees(row.lineTotal)}</strong>
        {row.saving > 0 ? <small>You save {formatRupees(row.saving)}</small> : null}
      </div>

      <div className="cart-line__actions">
        <button type="button" className="cart-line__action" onClick={() => onSave(row)}>
          <Heart size={15} aria-hidden="true" /> Move to wishlist
        </button>
        {remove}
      </div>
    </article>
  );
}
