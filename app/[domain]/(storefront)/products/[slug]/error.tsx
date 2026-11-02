"use client";

import Button from "@/components/ui/button";

export default function ProductError({ reset }: { reset: () => void }) {
  return (
    <main className="empty-state content-width" role="alert">
      <h1>We couldn&apos;t load this product</h1>
      <p>Please retry, or return to the catalog.</p>
      <Button type="button" onClick={reset}>Try again</Button>
    </main>
  );
}