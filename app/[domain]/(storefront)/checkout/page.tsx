import { Suspense } from "react";
import type { Metadata } from "next";
import CheckoutPageClient from "@/features/checkout/components/checkout-page-client";
import EmptyState from "@/components/ui/empty-state";
import type { AddressBook } from "@/features/account/types";
import { getCurrentAccountUser } from "@/lib/auth/current-customer";
import { toSessionUser } from "@/lib/auth/session-user";
import { toAddressBook } from "@/lib/services/address.service";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Review your wholesale order and shipping details.",
};

type CheckoutPageProps = {
  searchParams: Promise<{ intent?: string | string[] }>;
};

/** The shopper and their address book come with the page: checkout makes no request to start. */
async function CheckoutContent({ searchParams }: CheckoutPageProps) {
  const [params, user] = await Promise.all([searchParams, getCurrentAccountUser()]);
  const customer = user ? toSessionUser(user) : null;
  return (
    <CheckoutPageClient
      // A sign-in or sign-out (in any tab) starts checkout over with the new account's addresses.
      key={customer?.id ?? "guest"}
      buyNow={params.intent === "buy-now"}
      customer={customer}
      initialAddressBook={user ? (toAddressBook(user) as AddressBook) : null}
    />
  );
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
