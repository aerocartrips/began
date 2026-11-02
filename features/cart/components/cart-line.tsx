"use client";

import Image from "next/image";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import QuantitySelector from "@/components/ui/quantity-selector";
import { cartActions } from "@/features/cart/cart-store";
import { formatNumber, formatRupees } from "@/lib/format";
import type { PricedCartLine } from "@/features/cart/types";

/** One priced cart line, with any MOQ / stock problems shown inline. */
export default function CartLine({ line, editable = true }: { line: PricedCartLine; editable?: boolean }) {
  const remove = () => cartActions.remove(line);

  if (line.unavailable) {
    return (
      <article className="cart-line is-unavailable">
        <p>This product is no longer available.</p>
        {editable ? <button type="button" className="text-button" onClick={remove}>Remove</button> : null}
      </article>
    );
  }

  const minimum = line.minimumQuantity ?? 1;
  const maximum = Math.max(line.available ?? minimum, minimum);

  return (
    <article className="cart-line">
      <Link href={`/products/${line.slug}`} className="cart-line__image">
        {line.imageUrl ? <Image src={line.imageUrl} alt="" fill sizes="96px" className="cover-image" /> : null}
      </Link>
      <div className="cart-line__body">
        <h3><Link href={`/products/${line.slug}`}>{line.name}</Link></h3>
        <p className="cart-line__meta">
          {line.colorName ? (
            <span><span className="swatch" style={{ backgroundColor: line.colorHex }} aria-hidden="true" /> {line.colorName} · </span>
          ) : null}
          SKU {line.sku} · {formatRupees(line.unitPrice ?? 0)}/piece
        </p>
        {minimum > 1 ? <p className="cart-line__meta">Minimum order {formatNumber(minimum)} pieces</p> : null}
        {line.issues?.map((issue) => (
          <p key={issue.message} className="cart-line__issue" role="alert">{issue.message}</p>
        ))}
      </div>
      <div className="cart-line__actions">
        {editable ? (
          <>
            <QuantitySelector
              value={line.quantity}
              minimum={minimum}
              maximum={maximum}
              onChange={(quantity) => cartActions.setQuantity(line, quantity)}
            />
            <button type="button" className="icon-button" onClick={remove} aria-label={`Remove ${line.name}`}>
              <Trash2 size={16} />
            </button>
          </>
        ) : (
          <span>× {formatNumber(line.quantity)}</span>
        )}
        <strong>{formatRupees(line.lineTotal ?? 0)}</strong>
      </div>
    </article>
  );
}
