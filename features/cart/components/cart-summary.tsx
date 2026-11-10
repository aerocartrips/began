import { ArrowRight, FileText, Lock } from "lucide-react";
import Button from "@/components/ui/button";
import PurchaseTermsList from "@/components/catalog/purchase-terms-list";
import OrderTotals from "@/features/cart/components/order-totals";
import type { PurchaseTerm } from "@/lib/catalog/purchase-terms";
import type { CartPricing } from "@/features/cart/types";
import { formatRupees } from "@/lib/format";

type CartSummaryProps = {
  pricing: CartPricing | null;
  pieces: number;
  salesMode: "wholesale" | "retail";
  /** Total saved on bulk ("was") prices across the cart. */
  savings: number;
  updating: boolean;
  /** Lines need fixing first (or prices could not be loaded). */
  blocked: boolean;
  shipping: { flat: number; freeFrom: number };
  terms: PurchaseTerm[];
};

/** How far the order is from free shipping, when the store offers it above a subtotal. */
function FreeShippingProgress({ subtotal, flat, freeFrom }: { subtotal: number; flat: number; freeFrom: number }) {
  if (flat <= 0 || freeFrom <= 0 || subtotal >= freeFrom) return null;
  const percent = Math.min(100, Math.round((subtotal / freeFrom) * 100));
  return (
    <div className="shipping-progress">
      <p>
        Add <strong>{formatRupees(freeFrom - subtotal)}</strong> more for free shipping
      </p>
      <span className="shipping-progress__track" role="progressbar" aria-label="Progress to free shipping" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${percent}%` }} />
      </span>
    </div>
  );
}

/** The cart's order summary: server-priced totals and the ways forward. */
export default function CartSummary({ pricing, pieces, salesMode, savings, updating, blocked, shipping, terms }: CartSummaryProps) {
  return (
    <aside className="cart-summary" aria-labelledby="cart-summary-title">
      <div className="cart-summary__card">
        <h2 id="cart-summary-title">Order summary</h2>
        {pricing ? <FreeShippingProgress subtotal={pricing.totals.subtotal} flat={shipping.flat} freeFrom={shipping.freeFrom} /> : null}
        <OrderTotals totals={pricing?.totals ?? null} pieces={pieces} gstRates={pricing?.gstRates} salesMode={salesMode} updating={updating} />
        {savings > 0 ? (
          <p className="order-savings">
            You save <strong>{formatRupees(savings)}</strong> {salesMode === "wholesale" ? "with bulk pricing" : "on this order"}
          </p>
        ) : null}
        {blocked ? (
          <button type="button" className="button button-primary cart-summary__checkout" disabled>
            Proceed to checkout
          </button>
        ) : (
          <Button href="/checkout" className="cart-summary__checkout" icon={<ArrowRight size={17} aria-hidden="true" />}>
            Proceed to checkout
          </Button>
        )}
        {blocked ? <p className="cart-summary__note">Update the highlighted items to continue.</p> : null}
        {salesMode === "wholesale" ? (
          <Button href="/request-quote?from=cart" variant="secondary" className="cart-summary__quote" icon={<FileText size={16} aria-hidden="true" />}>
            Request a quote instead
          </Button>
        ) : null}
        <p className="cart-summary__secure">
          <Lock size={13} aria-hidden="true" /> Secure checkout
        </p>
      </div>
      <PurchaseTermsList terms={terms} label="Payment, shipping and returns" className="purchase-terms--compact" />
    </aside>
  );
}
