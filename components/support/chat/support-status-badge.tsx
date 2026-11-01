import { CUSTOMER_STATUS_COPY } from "@/features/support/support-labels";
import type { CustomerSupportStatus } from "@/features/support/types";

export default function SupportStatusBadge({ status }: { status: CustomerSupportStatus }) {
  return <span className={`support-status is-${status}`}>{CUSTOMER_STATUS_COPY[status]?.label ?? status}</span>;
}
