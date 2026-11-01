import type { CustomerSupportStatus, SupportCategory } from "@/features/support/types";

export const SUPPORT_CATEGORY_OPTIONS: { value: SupportCategory; label: string }[] = [
  { value: "order", label: "Order related" },
  { value: "payment", label: "Payment issue" },
  { value: "shipping", label: "Shipping and delivery" },
  { value: "product", label: "Product inquiry" },
  { value: "return", label: "Return / refund" },
  { value: "other", label: "Other" },
];

const CATEGORY_LABELS = new Map(SUPPORT_CATEGORY_OPTIONS.map((option) => [option.value, option.label]));

export function categoryLabel(category: string | null | undefined) {
  return CATEGORY_LABELS.get(category as SupportCategory) ?? "Other";
}

/** Categories where linking an order helps the team respond. */
export const ORDER_LINKED_CATEGORIES = new Set<SupportCategory>(["order", "payment", "shipping", "return"]);

export const CUSTOMER_STATUS_COPY: Record<CustomerSupportStatus, { label: string; detail: string }> = {
  open: { label: "Open", detail: "Our team will reply shortly." },
  pending: { label: "Pending", detail: "Our team is working on this." },
  resolved: { label: "Resolved", detail: "Marked resolved. Reply to reopen if you still need help." },
  closed: { label: "Closed", detail: "This conversation is closed." },
};

export const SUPPORT_MESSAGE_MAX = 5000;
