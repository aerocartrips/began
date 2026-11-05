import type { ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, Clock3, Info, type LucideIcon } from "lucide-react";

export type NoticeTone = "info" | "warning" | "danger" | "success" | "pending";

const TONE_ICONS: Record<NoticeTone, LucideIcon> = {
  info: Info,
  warning: AlertTriangle,
  danger: AlertCircle,
  success: CheckCircle2,
  pending: Clock3,
};

type NoticeCardProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Extra lines under the description (order number, references…). */
  detail?: ReactNode;
  /** Shown on the right: usually a <NoticeLink>, or buttons. */
  action?: ReactNode;
  tone?: NoticeTone;
  /** Overrides the tone's icon. */
  icon?: LucideIcon;
  /** Heading element for the title; a plain bold line by default. */
  titleAs?: "h2" | "h3" | "strong";
  /** "alert" for errors that need attention now, "status" for updates; omit for static notices. */
  live?: "alert" | "status";
  busy?: boolean;
  className?: string;
};

/**
 * The single inline message style of the store and admin: account notices,
 * sign-in prompts, errors, warnings and payment status. A coloured edge and
 * icon carry the tone; the action sits on the right (below the text on phones).
 */
export default function NoticeCard({
  title,
  description,
  detail,
  action,
  tone = "info",
  icon,
  titleAs: Title = "strong",
  live,
  busy,
  className,
}: NoticeCardProps) {
  const Icon = icon ?? TONE_ICONS[tone];
  return (
    <div
      className={["notice-card", `notice-card--${tone}`, className].filter(Boolean).join(" ")}
      role={live}
      aria-live={live === "status" ? "polite" : undefined}
      aria-busy={busy || undefined}
    >
      <Icon className="notice-card__icon" size={18} aria-hidden="true" />
      <div className="notice-card__body">
        <Title className="notice-card__title">{title}</Title>
        {description ? <p className="notice-card__text">{description}</p> : null}
        {detail ? <div className="notice-card__detail">{detail}</div> : null}
      </div>
      {action ? <div className="notice-card__action">{action}</div> : null}
    </div>
  );
}

/** The notice's call to action: "Label →". */
export function NoticeLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="notice-link">
      {children} <ArrowRight size={13} aria-hidden="true" />
    </Link>
  );
}
