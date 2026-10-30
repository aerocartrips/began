const LABELS: Record<string, string> = {
  pending: "Pending",
  pending_payment: "Pending payment",
  confirmed: "Confirmed",
  processing: "Processing",
  packed: "Packed",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  return_requested: "Return requested",
  returned: "Returned",
  paid: "Paid",
  failed: "Payment failed",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
};

type OrderStatusBadgeProps = {
  kind: "order" | "payment";
  status: string;
};

export default function OrderStatusBadge({ kind, status }: OrderStatusBadgeProps) {
  const label = LABELS[status] ?? status.replaceAll("_", " ");
  return (
    <span className={`order-status-badge order-status-badge--${kind} is-${status.replaceAll("_", "-")}`}>
      {label}
    </span>
  );
}

export function formatOrderStatus(status: string) {
  return LABELS[status] ?? status.replaceAll("_", " ");
}
