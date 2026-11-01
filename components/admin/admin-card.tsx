import type { ReactNode } from "react";

type AdminCardProps = {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  id?: string;
  children?: ReactNode;
};

export default function AdminCard({ title, description, action, className, id, children }: AdminCardProps) {
  return (
    <section className={["admin-card", className].filter(Boolean).join(" ")} id={id}>
      {title || action ? (
        <header className="admin-card__head">
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {action ? <div className="admin-card__action">{action}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function AdminDetailList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="admin-detail-list">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value === null || item.value === undefined || item.value === "" ? "—" : item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
