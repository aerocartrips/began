import Link from "next/link";
import Button from "@/components/ui/button";
import { formatCurrency } from "@/lib/format-currency";

type CartSummaryProps = {
  itemCount: number;
  subtotalCents: number;
  checkoutHref?: string;
  checkoutDisabled?: boolean;
  showCheckout?: boolean;
};

export default function CartSummary({
  itemCount,
  subtotalCents,
  checkoutHref = "/checkout",
  checkoutDisabled = false,
  showCheckout = true,
}: CartSummaryProps) {
  return (
    <aside className="cart-summary" aria-labelledby="summary-title">
      <h2 id="summary-title">Order summary</h2>
      <div className="cart-summary-line">
        <span>Items ({itemCount})</span>
        <span>{formatCurrency(subtotalCents)}</span>
      </div>
      <div className="cart-summary-line">
        <span>Shipping</span>
        <span>Supplier quote</span>
      </div>
      <p className="cart-summary-note">
        Shipping and applicable taxes are confirmed with the supplier before an order is accepted.
      </p>
      <div className="cart-summary-total">
        <strong>Subtotal</strong>
        <strong>{formatCurrency(subtotalCents)}</strong>
      </div>
      {showCheckout && (
        checkoutDisabled ? (
          <button className="cart-checkout-button" type="button" disabled>
            Proceed to Checkout
          </button>
        ) : (
          <Button href={checkoutHref} className="cart-checkout-button">
            Proceed to Checkout
          </Button>
        )
      )}
      <Link className="continue-shopping" href="/products">Continue shopping</Link>
    </aside>
  );
}