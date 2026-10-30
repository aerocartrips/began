"use client";

import ErrorCard from "@/components/ui/feedback/ErrorCard";
import Button from "@/components/ui/button";

export default function CartSectionError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="commerce-page content-width">
      <ErrorCard
        title="Your cart could not be loaded"
        description="Something went wrong while preparing your cart. Please try again."
        action={
          <Button type="button" onClick={reset}>
            Try again
          </Button>
        }
      />
    </main>
  );
}
