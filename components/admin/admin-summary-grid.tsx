import type { ReactNode } from "react";

export type SummaryItem = {
  label: string;
  value: ReactNode;
  detail?: string;
};

export default function AdminSummaryGrid({ items, label = "Summary" }: { items: SummaryItem[]; label?: string }) {
  if (items.length === 0) return null;
  return (
    <section className="admin-summary-grid" aria-label={label}>
      {items.map((item) => (
        <article className="admin-summary-card" key={item.label}>
          <p>{item.label}</p>
          <strong>{item.value}</strong>
          {item.detail ? <span>{item.detail}</span> : null}
        </article>
      ))}
    </section>
  );
}
