"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import Button from "@/components/ui/button";
import QuantitySelector from "@/components/ui/quantity-selector";
import { useCart } from "@/features/cart/cart-provider";
import type { CartLine } from "@/features/cart/types/cart";
import { formatCurrency } from "@/lib/format-currency";

type CartItemProps = {
  item: CartLine;
};

export default function CartItem({ item }: CartItemProps) {
  const { removeItem, updateQuantity } = useCart();
  const [message, setMessage] = useState("");
  const selectedOptions = Object.entries(item.selectedOptions).map(([optionId, valueId]) => {
    const option = item.product.options.find((candidate) => candidate.id === optionId);
    const value = option?.values.find((candidate) => candidate.id === valueId);
    return option && value ? `${option.label}: ${value.label}` : null;
  }).filter((value): value is string => value !== null);

  return (
    <article className="cart-item">
      <Link className="cart-item-image" href={`/products/${item.product.slug}`}>
        <Image
          src={item.product.images[0].src}
          alt={item.product.images[0].alt}
          fill
          sizes="120px"
          className="cover-image"
        />
      </Link>
      <div className="cart-item-details">
        <div className="cart-item-heading">
          <div>
            <h2><Link href={`/products/${item.product.slug}`}>{item.product.title}</Link></h2>
            <p>{item.product.details}</p>
            {selectedOptions.map((option) => <span className="cart-item-option" key={option}>{option}</span>)}
          </div>
          <strong>{formatCurrency(item.lineTotalCents, item.product.currency)}</strong>
        </div>
        <div className="cart-item-controls">
          <QuantitySelector
            value={item.quantity}
            minimum={item.product.minimumOrderQuantity}
            maximum={item.product.inventory}
            onChange={(quantity) => {
              const result = updateQuantity(item.key, quantity);
              setMessage(result.ok ? "" : result.message);
            }}
          />
          <Button
            type="button"
            variant="form"
            className="text-button"
            onClick={() => removeItem(item.key)}
          >
            Remove
          </Button>
          {message && <span className="purchase-feedback is-error" role="alert">{message}</span>}
        </div>
      </div>
    </article>
  );
}