import type { Metadata } from "next";
import CartPageClient from "@/features/cart/components/cart-page-client";
import { purchaseTerms } from "@/lib/catalog/purchase-terms";
import { getStorePolicies } from "@/lib/content/pages";
import { getCurrentTenant } from "@/lib/tenant/current";

export const metadata: Metadata = {
  title: "Shopping Cart",
  description: "Review the products in your cart.",
  robots: { index: false },
};

/**
 * The cart lives in the browser; the store's terms (shipping, returns,
 * payments) come with the page, so it makes no request beyond pricing.
 */
export default async function CartPage() {
  const tenant = await getCurrentTenant();
  const policies = await getStorePolicies(tenant.id);
  const terms = purchaseTerms(policies, {
    salesMode: tenant.salesMode,
    paymentsEnabled: Boolean(tenant.razorpayKeyId),
    hasGstin: Boolean(tenant.business.gstin),
  });
  return (
    <CartPageClient
      terms={terms}
      shipping={{ flat: policies.shippingFlatAmount, freeFrom: policies.shippingFreeThreshold }}
      lowStockThreshold={policies.lowStockThreshold}
    />
  );
}
