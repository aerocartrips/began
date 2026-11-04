import type { Metadata } from "next";
import { Suspense } from "react";
import NewsletterTokenAction from "@/components/newsletter/newsletter-token-action";

export const metadata: Metadata = { title: "Confirm your subscription", robots: { index: false, follow: false } };

export default function NewsletterConfirmPage() {
  return (
    <main className="content-page content-width">
      <header className="content-page__header">
        <h1>Confirm your subscription</h1>
      </header>
      <Suspense fallback={<p>Loading…</p>}>
        <NewsletterTokenAction action="confirm" />
      </Suspense>
    </main>
  );
}
