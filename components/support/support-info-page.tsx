import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type SupportInfoItem = {
  icon: LucideIcon;
  title: string;
  body: ReactNode;
};

type SupportInfoPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  items: SupportInfoItem[];
  ctaTitle: string;
};

/** Shared layout for static support pages (shipping, returns), styled like the contact page. */
export default function SupportInfoPage({ eyebrow, title, description, items, ctaTitle }: SupportInfoPageProps) {
  return (
    <main className="contact-page content-width">
      <header className="contact-hero">
        <p className="contact-eyebrow"><span />{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <section className="support-info-grid">
        {items.map(({ icon: Icon, title: itemTitle, body }) => (
          <article className="support-info-card" key={itemTitle}>
            <span className="contact-info-icon"><Icon size={17} aria-hidden="true" /></span>
            <h2>{itemTitle}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>
      <aside className="contact-cta">
        <div><p className="contact-eyebrow">Still have a question?</p><h2>{ctaTitle}</h2></div>
        <Link href="/contact">Contact our team<span aria-hidden="true">→</span></Link>
      </aside>
    </main>
  );
}
