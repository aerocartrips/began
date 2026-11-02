"use client";

import ErrorCard from "@/components/ui/feedback/error-card";
import Button from "@/components/ui/button";

export default function AccountSectionError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="commerce-page content-width">
      <ErrorCard
        title="Account section unavailable"
        description="Something went wrong while loading this account page."
        action={<Button type="button" onClick={reset}>Try again</Button>}
      />
    </main>
  );
}
