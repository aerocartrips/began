import Link from "next/link";
import Button from "@/components/ui/button";
import { formatNumber, formatRupees } from "@/lib/format";
import type { CartTotals } from "@/features/cart/types";

type CartSummaryProps = {
  itemCount: number;
  totals: CartTotals | null;
  loading?: boolean;
  checkoutHref?: string;
  checkoutDisabled?: boolean;
  showCheckout?: boolean;
  secondaryAction?: React.ReactNode;
};

/** Totals priced by the server: subtotal, shipping, GST and the amount payable. */
export default function CartSummary({
  itemCount,
  totals,
  loading = false,
  checkoutHref = "/checkout",
  checkoutDisabled = false,
  showCheckout = true,
  secondaryAction,
}: CartSummaryProps) {
  const value = (amount: number | undefined) => (loading || amount === undefined ? "…" : formatRupees(amount));
  return (
    <aside className="cart-summary" aria-labelledby="summary-title" aria-busy={loading}>
      <h2 id="summary-title">Order summary</h2>
      <div className="cart-summary-line">
        <span>Items ({formatNumber(itemCount)} pcs)</span>
        <span>{value(totals?.subtotal)}</span>
      </div>
      <div className="cart-summary-line">
        <span>Shipping</span>
        <span>{totals && !loading && totals.shippingCharges === 0 ? "Free" : value(totals?.shippingCharges)}</span>
      </div>
      <div className="cart-summary-line">
        <span>GST</span>
        <span>{value(totals?.tax)}</span>
      </div>
      <div className="cart-summary-total">
        <strong>Total</strong>
        <strong>{value(totals?.totalAmount)}</strong>
      </div>
      {showCheckout ? (
        checkoutDisabled || loading ? (
          <button className="cart-checkout-button" type="button" disabled>
            Proceed to checkout
          </button>
        ) : (
          <Button href={checkoutHref} className="cart-checkout-button">
            Proceed to checkout
          </Button>
        )
      ) : null}
      {secondaryAction}
      <Link className="continue-shopping" href="/products">Continue shopping</Link>
    </aside>
  );
}
