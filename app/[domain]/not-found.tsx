import type { Metadata } from "next";
import Link from "next/link";
import EmptyState from "@/components/ui/empty-state";
import { ROBOTS_NOINDEX } from "@/lib/seo/robots";

/** Next.js also answers 404 here (or adds noindex once a response has started streaming). */
export const metadata: Metadata = { title: "Page not found", robots: ROBOTS_NOINDEX };

export default function StoreNotFound() {
  return (
    <main className="commerce-page content-width">
      <EmptyState
        title="Page not found"
        description="The page you are looking for has moved or no longer exists."
        action={<Link className="text-link" href="/products">Browse the catalogue</Link>}
      />
    </main>
  );
}
