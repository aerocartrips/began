"use client";

import { useState } from "react";
import AddToCartButton from "@/components/marketplace/add-to-cart-button";
import BuyNowButton from "@/components/marketplace/buy-now-button";
import QuantitySelector from "@/components/ui/quantity-selector";
import type { Product } from "@/features/products/types/product";

type ProductPurchasePanelProps = {
  product: Product;
};

export default function ProductPurchasePanel({ product }: ProductPurchasePanelProps) {
  const [quantity, setQuantity] = useState(product.minimumOrderQuantity);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const available = product.inventory >= product.minimumOrderQuantity;

  return (
    <div className="product-purchase-panel">
      {product.options.map((option) => (
        <label className="product-option" htmlFor={`option-${option.id}`} key={option.id}>
          <span>{option.label}{option.required !== false ? " *" : ""}</span>
          <select
            id={`option-${option.id}`}
            value={selectedOptions[option.id] ?? ""}
            required={option.required !== false}
            onChange={(event) => {
              setSelectedOptions((current) => ({
                ...current,
                [option.id]: event.currentTarget.value,
              }));
            }}
          >
            <option value="">Choose {option.label.toLowerCase()}</option>
            {option.values.map((value) => (
              <option key={value.id} value={value.id} disabled={value.available === false}>
                {value.label}{value.available === false ? " (Unavailable)" : ""}
              </option>
            ))}
          </select>
        </label>
      ))}
      <div className="product-quantity-row">
        <div>
          <span className="purchase-label">Order quantity</span>
          <p>Minimum {product.minimumOrderQuantity} units</p>
        </div>
        <QuantitySelector
          value={quantity}
          minimum={product.minimumOrderQuantity}
          maximum={product.inventory}
          disabled={!available}
          onChange={setQuantity}
        />
      </div>
      {!available && <p className="purchase-error" role="status">Currently unavailable</p>}
      <div className="product-purchase-actions">
        <AddToCartButton
          productId={product.id}
          quantity={quantity}
          selectedOptions={selectedOptions}
          variant="secondary"
          disabled={!available}
        />
        <BuyNowButton key={product.id}
          productId={product.id}
          quantity={quantity}
          selectedOptions={selectedOptions}
          disabled={!available}
        />
      </div>
    </div>
  );
}