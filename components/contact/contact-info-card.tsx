import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type ContactInfoCardProps = {
  icon: LucideIcon;
  title: string;
  value: string | null;
  description: string;
  href?: string | null;
};

export default function ContactInfoCard({
  icon: Icon,
  title,
  value,
  description,
  href,
}: ContactInfoCardProps) {
  return (
    <article className="contact-info-card">
      <span className="contact-info-icon"><Icon size={18} strokeWidth={1.8} aria-hidden="true" /></span>
      <div>
        <h2>{title}</h2>
        {value && href ? (
          href.startsWith("/") ? <Link className="contact-info-value" href={href}>{value}</Link> : <a className="contact-info-value" href={href}>{value}</a>
        ) : (
          <p className="contact-info-unconfigured">Not configured yet</p>
        )}
        <p className="contact-info-description">{description}</p>
      </div>
    </article>
  );
}