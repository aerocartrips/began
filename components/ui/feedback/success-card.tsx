import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";

type SuccessCardProps = {
  title: string;
  description: ReactNode;
  detail?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export default function SuccessCard({
  title,
  description,
  detail,
  action,
  className,
}: SuccessCardProps) {
  return (
    <section
      className={["feedback-card feedback-card--success", className].filter(Boolean).join(" ")}
      role="status"
      aria-live="polite"
    >
      <span className="feedback-card__icon" aria-hidden="true">
        <CheckCircle2 size={28} />
      </span>
      <div className="feedback-card__body">
        <h2>{title}</h2>
        <p>{description}</p>
        {detail ? <div className="feedback-card__detail">{detail}</div> : null}
        {action ? <div className="feedback-card__actions">{action}</div> : null}
      </div>
    </section>
  );
}
