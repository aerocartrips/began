import type { ReactNode } from "react";
import { Clock3 } from "lucide-react";

type PendingCardProps = {
  title: string;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
};

export default function PendingCard({ title, description, action, className }: PendingCardProps) {
  return (
    <section
      className={["feedback-card feedback-card--pending", className].filter(Boolean).join(" ")}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="feedback-card__icon" aria-hidden="true">
        <Clock3 size={28} />
      </span>
      <div className="feedback-card__body">
        <h2>{title}</h2>
        <p>{description}</p>
        {action ? <div className="feedback-card__actions">{action}</div> : null}
      </div>
    </section>
  );
}
