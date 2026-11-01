import { formatOrderStatus } from "@/features/orders/order-status-badge";
import { ORDER_STATUS } from "@/lib/constants/order-status";
import { formatDateTime } from "@/lib/format";

const FULFILLMENT_STEPS = [
  ORDER_STATUS.PENDING_PAYMENT,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.PACKED,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.OUT_FOR_DELIVERY,
  ORDER_STATUS.DELIVERED,
];

const EXCEPTION_STATUSES = new Set([
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.RETURN_REQUESTED,
  ORDER_STATUS.RETURNED,
]);

type TimelineProps = {
  orderStatus: string;
  paymentStatus: string;
  history?: {
    newOrderStatus?: string;
    newPaymentStatus?: string;
    customerVisibleRemark?: string;
    remarks?: string;
    createdAt?: string;
  }[];
};

function historyForStatus(history: TimelineProps["history"], status: string) {
  return history?.find((entry) => entry.newOrderStatus === status);
}

export default function OrderTimeline({ orderStatus, paymentStatus, history }: TimelineProps) {
  if (EXCEPTION_STATUSES.has(orderStatus)) {
    return (
      <ol className="order-timeline order-timeline--exception">
        <li className="is-current">
          <strong>{formatOrderStatus(orderStatus)}</strong>
          <p>
            {orderStatus === ORDER_STATUS.CANCELLED
              ? "This order was cancelled."
              : "This order is in a return or post-delivery review state."}
          </p>
          <small>Payment status: {formatOrderStatus(paymentStatus)}</small>
        </li>
      </ol>
    );
  }

  const currentIndex = FULFILLMENT_STEPS.indexOf(orderStatus);
  const activeIndex = currentIndex >= 0 ? currentIndex : 0;

  return (
    <ol className="order-timeline" aria-label="Order progress">
      {FULFILLMENT_STEPS.map((step, index) => {
        const entry = historyForStatus(history, step);
        const state =
          index < activeIndex ? "complete" : index === activeIndex ? "current" : "upcoming";
        return (
          <li key={step} className={`is-${state}`}>
            <strong>{formatOrderStatus(step)}</strong>
            {entry?.createdAt ? (
              <small>{formatDateTime(entry.createdAt)}</small>
            ) : null}
            {entry?.customerVisibleRemark || entry?.remarks ? (
              <p>{entry.customerVisibleRemark || entry.remarks}</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
