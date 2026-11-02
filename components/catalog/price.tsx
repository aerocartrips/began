import { formatRupees } from "@/lib/format";

type PriceProps = {
  amount: number;
  compareAt?: number | null;
  /** Wholesale stores price per piece. */
  perPiece?: boolean;
  className?: string;
};

export default function Price({ amount, compareAt, perPiece = false, className = "catalog-price" }: PriceProps) {
  return (
    <p className={className}>
      <strong>{formatRupees(amount)}</strong>
      {perPiece ? <span className="catalog-price__unit">/piece</span> : null}
      {compareAt ? (
        <del aria-label={`Was ${formatRupees(compareAt)}`}>{formatRupees(compareAt)}</del>
      ) : null}
    </p>
  );
}
