import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
};

export default function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <section className={["empty-state", className].filter(Boolean).join(" ")}>
      {icon ? <span className="empty-state__icon" aria-hidden="true">{icon}</span> : null}
      <h1>{title}</h1>
      <p>{description}</p>
      {action}
    </section>
  );
}
