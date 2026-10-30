"use client";

import ErrorCard from "@/components/ui/feedback/ErrorCard";
import Button from "@/components/ui/button";

export default function CheckoutSectionError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="commerce-page content-width">
      <ErrorCard
        title="Checkout unavailable"
        description="We could not load checkout safely. Your cart has not been charged."
        action={<Button type="button" onClick={reset}>Try again</Button>}
      />
    </main>
  );
}
