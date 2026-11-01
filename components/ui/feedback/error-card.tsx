import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

type ErrorCardProps = {
  title: string;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
};

export default function ErrorCard({ title, description, action, className }: ErrorCardProps) {
  return (
    <section
      className={["feedback-card feedback-card--error", className].filter(Boolean).join(" ")}
      role="alert"
    >
      <span className="feedback-card__icon" aria-hidden="true">
        <AlertCircle size={28} />
      </span>
      <div className="feedback-card__body">
        <h2>{title}</h2>
        <p>{description}</p>
        {action ? <div className="feedback-card__actions">{action}</div> : null}
      </div>
    </section>
  );
}
