import { formatRupees } from "@/lib/format";
import type { StorePolicies } from "@/lib/content/types";

export type PurchaseTermKey = "payments" | "shipping" | "returns" | "invoice";

export type PurchaseTerm = { key: PurchaseTermKey; title: string; detail: string };

type StoreFacts = {
  salesMode: "wholesale" | "retail";
  /** Online payment is set up (Razorpay). */
  paymentsEnabled: boolean;
  /** The store has a GSTIN, so its invoices are GST tax invoices. */
  hasGstin: boolean;
};

/**
 * What a shopper is promised when buying, built only from the store's real
 * settings (Admin → Settings) so the product page never claims more than
 * checkout delivers: shipping follows calculateShipping() in
 * lib/services/order-pricing.js, returns follow the return window.
 */
export function purchaseTerms(policies: StorePolicies, store: StoreFacts): PurchaseTerm[] {
  const terms: PurchaseTerm[] = [];
  if (store.paymentsEnabled) {
    terms.push({ key: "payments", title: "Secure payments", detail: "UPI, cards and net banking via Razorpay." });
  }

  const flat = policies.shippingFlatAmount;
  const threshold = policies.shippingFreeThreshold;
  if (flat <= 0) {
    terms.push({ key: "shipping", title: "Free shipping", detail: "On every order." });
  } else if (threshold > 0) {
    terms.push({
      key: "shipping",
      title: `Free shipping over ${formatRupees(threshold)}`,
      detail: `${formatRupees(flat)} flat on smaller orders.`,
    });
  } else {
    terms.push({ key: "shipping", title: "Flat-rate shipping", detail: `${formatRupees(flat)} per order.` });
  }

  if (policies.returnWindowDays > 0) {
    terms.push({
      key: "returns",
      title: `${policies.returnWindowDays}-day returns`,
      detail: "Request a return from your orders page after delivery.",
    });
  }

  if (store.hasGstin) {
    terms.push({
      key: "invoice",
      title: "GST invoice",
      detail: store.salesMode === "wholesale" ? "Claim input tax credit on every order." : "With every order.",
    });
  }
  return terms;
}
