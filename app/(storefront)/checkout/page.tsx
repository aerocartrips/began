import { Suspense } from "react";
import type { Metadata } from "next";
import CheckoutPageClient from "@/features/checkout/components/checkout-page-client";
import EmptyState from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Checkout | Norosilk",
  description: "Review your wholesale order and shipping details.",
};

type CheckoutPageProps = {
  searchParams: Promise<{ intent?: string | string[] }>;
};

async function CheckoutContent({ searchParams }: CheckoutPageProps) {
  const params = await searchParams;
  return <CheckoutPageClient buyNow={params.intent === "buy-now"} />;
}

export default function CheckoutPage(props: CheckoutPageProps) {
  return (
    <Suspense
      fallback={(
        <main className="commerce-page content-width">
          <EmptyState title="Preparing checkout" description="Loading your purchase summary..." />
        </main>
      )}
    >
      <CheckoutContent searchParams={props.searchParams} />
    </Suspense>
  );
}