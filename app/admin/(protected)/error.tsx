"use client";

import ErrorCard from "@/components/ui/feedback/ErrorCard";
import Button from "@/components/ui/button";

export default function AdminSectionError({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorCard
      title="Admin section unavailable"
      description="Something went wrong while loading this dashboard view."
      action={<Button type="button" onClick={reset}>Try again</Button>}
    />
  );
}
