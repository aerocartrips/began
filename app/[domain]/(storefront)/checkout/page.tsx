import { Suspense } from "react";
import type { Metadata } from "next";
import CheckoutPageClient from "@/features/checkout/components/checkout-page-client";
import CheckoutSkeleton from "@/components/ui/loaders/checkout-skeleton";
import type { AddressBook } from "@/features/account/types";
import { requireAccountUser } from "@/lib/auth/current-customer";
import { toSessionUser } from "@/lib/auth/session-user";
import { purchaseTerms } from "@/lib/catalog/purchase-terms";
import { getStorePolicies } from "@/lib/content/pages";
import { toAddressBook } from "@/lib/services/address.service";
import { getCurrentTenant } from "@/lib/tenant/current";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Confirm delivery details and pay for your order.",
  robots: { index: false },
};

type CheckoutPageProps = {
  searchParams: Promise<{ intent?: string | string[] }>;
};

/**
 * The shopper, their address book and the store's terms come with the page:
 * checkout makes no request to start. proxy.ts sends shoppers without a
 * session to sign in first; an expired session is caught here.
 */
async function CheckoutContent({ searchParams }: CheckoutPageProps) {
  const buyNow = (await searchParams).intent === "buy-now";
  const [user, tenant] = await Promise.all([
    requireAccountUser(buyNow ? "/checkout?intent=buy-now" : "/checkout"),
    getCurrentTenant(),
  ]);
  const policies = await getStorePolicies(tenant.id);
  return (
    <CheckoutPageClient
      // A sign-in as someone else (in any tab) starts checkout over with that account's addresses.
      key={String(user._id)}
      buyNow={buyNow}
      customer={toSessionUser(user)}
      business={{ companyName: user.companyName ?? "", gstin: user.gstNumber ?? "" }}
      initialAddressBook={toAddressBook(user) as AddressBook}
      terms={purchaseTerms(policies, {
        salesMode: tenant.salesMode,
        paymentsEnabled: Boolean(tenant.razorpayKeyId),
        hasGstin: Boolean(tenant.business.gstin),
      })}
      reservationMinutes={policies.paymentReservationMinutes}
    />
  );
}

export default function CheckoutPage(props: CheckoutPageProps) {
  return (
    <Suspense fallback={<CheckoutSkeleton />}>
      <CheckoutContent searchParams={props.searchParams} />
    </Suspense>
  );
}
