import { FileText, RotateCcw, ShieldCheck, Truck, type LucideIcon } from "lucide-react";
import type { PurchaseTerm, PurchaseTermKey } from "@/lib/catalog/purchase-terms";

const ICONS: Record<PurchaseTermKey, LucideIcon> = {
  payments: ShieldCheck,
  shipping: Truck,
  returns: RotateCcw,
  invoice: FileText,
};

/** The store's purchase terms (payments, shipping, returns, invoices) as an icon list. */
export default function PurchaseTermsList({ terms, label, className }: { terms: PurchaseTerm[]; label: string; className?: string }) {
  if (terms.length === 0) return null;
  return (
    <ul className={className ? `purchase-terms ${className}` : "purchase-terms"} aria-label={label}>
      {terms.map(({ key, title, detail }) => {
        const Icon = ICONS[key];
        return (
          <li key={key}>
            <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
            <span>
              <strong>{title}</strong>
              <small>{detail}</small>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
