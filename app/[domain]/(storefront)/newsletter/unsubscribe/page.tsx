import type { Metadata } from "next";
import { Suspense } from "react";
import NewsletterTokenAction from "@/components/newsletter/newsletter-token-action";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };

export default function NewsletterUnsubscribePage() {
  return (
    <main className="content-page content-width">
      <header className="content-page__header">
        <h1>Unsubscribe</h1>
      </header>
      <Suspense fallback={<p>Loading…</p>}>
        <NewsletterTokenAction action="unsubscribe" />
      </Suspense>
    </main>
  );
}
