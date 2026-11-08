import type { ReactNode } from "react";
import Link from "next/link";

/** The centred account card used by the sign-in, register and password pages. */
export default function AuthCard({ eyebrow = "Your account", title, lead, children }: { eyebrow?: string; title: string; lead: string; children: ReactNode }) {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <header className="auth-card__head">
          <p className="eyebrow">{eyebrow}</p>
          <h1 id="auth-title">{title}</h1>
          <p className="auth-card__lead">{lead}</p>
        </header>
        {children}
      </section>
      <Link className="text-button auth-page__back" href="/products">Back to catalog</Link>
    </main>
  );
}
