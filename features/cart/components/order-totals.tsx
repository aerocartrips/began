import { formatNumber, formatRupees } from "@/lib/format";
import { gstLabel, unitLabel } from "@/features/cart/labels";
import type { CartTotals } from "@/features/cart/types";

type OrderTotalsProps = {
  totals: CartTotals | null;
  pieces: number;
  gstRates?: number[];
  salesMode: "wholesale" | "retail";
  /** "Total" while shopping; "Paid" on a paid order. */
  totalLabel?: string;
  /** A change is being repriced: the last totals stay, dimmed, instead of blinking out. */
  updating?: boolean;
};

const pending = <span className="order-totals__pending" aria-label="Calculating" />;

/**
 * Subtotal, shipping, GST and the total, as the server priced them. Cart,
 * checkout and the order confirmation all show the money this way.
 */
export default function OrderTotals({ totals, pieces, gstRates, salesMode, totalLabel = "Total", updating = false }: OrderTotalsProps) {
  const amount = (value: number | undefined) => (totals && value !== undefined ? formatRupees(value) : pending);
  return (
    <dl className="order-totals" data-updating={updating || undefined} aria-busy={updating || !totals || undefined}>
      <div>
        <dt>
          Subtotal <span>· {formatNumber(pieces)} {unitLabel(salesMode, pieces)}</span>
        </dt>
        <dd>{amount(totals?.subtotal)}</dd>
      </div>
      {totals?.discount ? (
        <div>
          <dt>Discount</dt>
          <dd>−{formatRupees(totals.discount)}</dd>
        </div>
      ) : null}
      <div>
        <dt>Shipping</dt>
        <dd>{totals?.shippingCharges === 0 ? <span className="order-totals__free">Free</span> : amount(totals?.shippingCharges)}</dd>
      </div>
      <div>
        <dt>{gstLabel(gstRates)}</dt>
        <dd>{amount(totals?.tax)}</dd>
      </div>
      <div className="order-totals__total">
        <dt>
          {totalLabel}
          <small>Inclusive of all taxes</small>
        </dt>
        <dd>{amount(totals?.totalAmount)}</dd>
      </div>
    </dl>
  );
}
