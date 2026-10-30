"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import LoadingButton from "@/components/ui/buttons/LoadingButton";
import { useCart } from "@/features/cart/cart-provider";
import type { SelectedOptions } from "@/features/cart/types/cart";

type BuyNowButtonProps = {
  productId: string;
  quantity: number;
  selectedOptions?: SelectedOptions;
  disabled?: boolean;
};

export default function BuyNowButton({
  productId,
  quantity,
  selectedOptions = {},
  disabled = false,
}: BuyNowButtonProps) {
  const router = useRouter();
  const { beginBuyNow } = useCart();
  const [message, setMessage] = useState("");
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);

  function handleBuyNow() {
    if (pendingRef.current) return;
    const result = beginBuyNow({ productId, quantity, selectedOptions });
    setMessage(result.message);
    if (!result.ok) return;

    pendingRef.current = true;
    setPending(true);
    router.push("/checkout?intent=buy-now");
  }

  return (
    <div className="purchase-action">
      <LoadingButton
        type="button"
        disabled={disabled || pending}
        loading={pending}
        loadingText="Opening checkout..."
        onClick={handleBuyNow}
        icon={<ArrowRight size={15} aria-hidden="true" />}
      >
        Buy Now
      </LoadingButton>
      <span className="purchase-feedback is-error" role="alert" aria-live="polite">
        {message && !pending ? message : ""}
      </span>
    </div>
  );
}
