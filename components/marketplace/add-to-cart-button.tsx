"use client";

import { useId, useState } from "react";
import type { ButtonHTMLAttributes } from "react";
import { ShoppingCart } from "lucide-react";
import { useOptionalFeedback } from "@/components/feedback/feedback-provider";
import LoadingButton from "@/components/ui/buttons/loading-button";
import { useCart } from "@/features/cart/cart-provider";
import type { SelectedOptions } from "@/features/cart/types/cart";

type AddToCartButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "type" | "onClick" | "disabled"
> & {
  productId: string;
  quantity: number;
  selectedOptions?: SelectedOptions;
  variant?: "primary" | "secondary" | "batch";
  disabled?: boolean;
};

export default function AddToCartButton({
  productId,
  quantity,
  selectedOptions = {},
  variant = "primary",
  disabled = false,
  className,
  ...buttonProps
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const feedback = useOptionalFeedback();
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const messageId = useId();

  function handleAdd() {
    if (loading) return;
    setLoading(true);
    const result = addItem({ productId, quantity, selectedOptions });
    setMessage(result.message);
    setIsError(!result.ok);
    if (result.ok) {
      feedback?.success("Added to cart", result.message, `cart-add-${productId}`);
      setMessage("");
    }
    setLoading(false);
  }

  return (
    <div className="purchase-action">
      <LoadingButton
        type="button"
        variant={variant}
        className={className}
        disabled={disabled}
        loading={loading}
        loadingText="Adding..."
        aria-describedby={message ? messageId : undefined}
        icon={<ShoppingCart size={15} aria-hidden="true" />}
        onClick={handleAdd}
        {...buttonProps}
      >
        Add to Cart
      </LoadingButton>
      <span
        className={`purchase-feedback${isError ? " is-error" : ""}`}
        id={messageId}
        role={isError ? "alert" : "status"}
        aria-live="polite"
      >
        {message}
      </span>
    </div>
  );
}
