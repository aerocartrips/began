import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

type WarningCardProps = {
  title: string;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
};

export default function WarningCard({ title, description, action, className }: WarningCardProps) {
  return (
    <section
      className={["feedback-card feedback-card--warning", className].filter(Boolean).join(" ")}
      role="status"
      aria-live="polite"
    >
      <span className="feedback-card__icon" aria-hidden="true">
        <AlertTriangle size={28} />
      </span>
      <div className="feedback-card__body">
        <h2>{title}</h2>
        <p>{description}</p>
        {action ? <div className="feedback-card__actions">{action}</div> : null}
      </div>
    </section>
  );
}
