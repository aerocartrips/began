"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import Button from "@/components/ui/button";
import ErrorCard from "@/components/ui/feedback/ErrorCard";
import PendingCard from "@/components/ui/feedback/PendingCard";
import WarningCard from "@/components/ui/feedback/WarningCard";
import DownloadInvoiceButton from "@/components/orders/download-invoice-button";
import OrderDetailReviewsSection from "@/components/reviews/order-detail-reviews-section";
import SuccessCard from "@/components/ui/feedback/SuccessCard";
import LoadingButton from "@/components/ui/buttons/LoadingButton";
import { OrderDetailSkeleton } from "@/components/ui/loaders/OrderListSkeleton";
import {
  cancelOrder,
  fetchOrderDetail,
  fetchOrderTracking,
  refreshOrderPayment,
  requestOrderReturn,
} from "@/features/orders/order-api";
import OrderStatusBadge from "@/features/orders/order-status-badge";
import OrderTimeline from "@/features/orders/order-timeline";
import type { OrderDetail, OrderPaymentInfo } from "@/features/orders/types";
import { fetchCurrentCustomer } from "@/features/checkout/submit-checkout-order";
import { useAsyncAction } from "@/hooks/useAsyncAction";

export default function CustomerOrderDetailClient({ orderId }: { orderId: string }) {
  const router = useRouter();
  const feedback = useFeedback();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [payment, setPayment] = useState<OrderPaymentInfo | null>(null);
  const [tracking, setTracking] = useState<Record<string, unknown> | null>(null);
  const [trackingMessage, setTrackingMessage] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [returnRemarks, setReturnRemarks] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const customer = await fetchCurrentCustomer();
      if (!customer) {
        router.push(`/account/login?next=/account/orders/${orderId}`);
        return;
      }
      const result = await fetchOrderDetail(orderId);
      setOrder(result.data?.order ?? null);
      setPayment(result.data?.payment ?? null);
      if (!result.data?.order) setError("Order not found.");
      else if (result.data.order.shipment?.awb) {
        const trackingResult = await fetchOrderTracking(orderId, false);
        const payload = trackingResult.data as { available?: boolean; message?: string; events?: unknown[] };
        if (payload?.available === false) {
          setTracking(null);
          setTrackingMessage(payload.message ?? "Tracking is not available yet.");
        } else {
          setTracking(payload as Record<string, unknown>);
          setTrackingMessage("");
        }
      }
    } catch {
      setError("We could not load this order.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(); // eslint-disable-line react-hooks/set-state-in-effect -- fetch order on mount
  }, [orderId]);

  const { run: runCancel, loading: cancelling } = useAsyncAction(async () => {
    if (!cancelReason.trim()) {
      feedback.warning("Reason required", "Tell us why you are cancelling this order.");
      return null;
    }
    if (!window.confirm("Cancel this order? Paid orders will begin a refund review with our payment provider.")) {
      return null;
    }
    await cancelOrder(orderId, cancelReason.trim());
    feedback.success("Order cancelled", "Your order was cancelled. Refund status will update when confirmed.");
    await load();
    return null;
  });

  const { run: runReturn, loading: returning } = useAsyncAction(async () => {
    if (!returnReason.trim()) {
      feedback.warning("Reason required", "Tell us why you are requesting a return.");
      return null;
    }
    await requestOrderReturn(orderId, returnReason.trim(), returnRemarks.trim() || undefined);
    feedback.success("Return requested", "Our team will review your return request.");
    await load();
    return null;
  });

  const { run: runRefreshPayment, loading: refreshingPayment } = useAsyncAction(async () => {
    await refreshOrderPayment(orderId);
    feedback.info("Payment refreshed", "We checked the latest payment status from our servers.");
    await load();
    return null;
  });

  const { run: runTracking, loading: trackingLoading } = useAsyncAction(async () => {
    const result = await fetchOrderTracking(orderId, true);
    const payload = result.data as { available?: boolean; message?: string; events?: unknown[] };
    if (payload?.available === false) {
      setTracking(null);
      setTrackingMessage(payload.message ?? "Tracking is not available yet.");
      return null;
    }
    setTracking(payload as Record<string, unknown>);
    setTrackingMessage("");
    return null;
  });

  if (loading && !order) return <OrderDetailSkeleton />;
  if (error || !order) {
    return (
      <main className="commerce-page content-width">
        <ErrorCard title="Order unavailable" description={error || "This order could not be found."} action={<Button href="/account/orders">Back to orders</Button>} />
      </main>
    );
  }

  const totalQty = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const canCancel =
    order.orderStatus !== "cancelled" &&
    !["shipped", "out_for_delivery", "delivered"].includes(order.orderStatus);
  const canReturn = order.orderStatus === "delivered";

  return (
    <main className="commerce-page content-width orders-detail-page">
      <div className="commerce-heading">
        <div>
          <p className="eyebrow">Order details</p>
          <h1>{order.orderNumber}</h1>
          <p className="orders-page-lead">Placed {new Date(order.createdAt).toLocaleString()}</p>
        </div>
        <Link className="text-button" href="/account/orders">Back to orders</Link>
      </div>

      <div className="orders-detail-actions">
        {order.paymentStatus !== "pending" ? <DownloadInvoiceButton orderId={order._id} /> : null}
      </div>

      <div className="orders-detail-badges">
        <OrderStatusBadge kind="order" status={order.orderStatus} />
        <OrderStatusBadge kind="payment" status={order.paymentStatus} />
      </div>

      {order.orderStatus === "cancelled" && order.cancellationRefund?.status && order.cancellationRefund.status !== "none" ? (
        <PendingCard
          title="Refund status"
          description={order.cancellationRefund.message || `Refund ${order.cancellationRefund.status.replaceAll("_", " ")}`}
        />
      ) : null}

      {order.orderStatus === "cancelled" && order.cancellation?.reason ? (
        <SuccessCard title="Order cancelled" description={order.cancellation.reason} />
      ) : null}

      {order.paymentStatus === "pending" ? (
        <PendingCard
          title="Payment pending"
          description="This order is waiting for confirmed payment."
          action={<LoadingButton type="button" variant="secondary" loading={refreshingPayment} onClick={() => void runRefreshPayment()}>Refresh payment status</LoadingButton>}
        />
      ) : null}

      <section className="orders-detail-grid">
        <div>
          <h2>Order progress</h2>
          <OrderTimeline orderStatus={order.orderStatus} paymentStatus={order.paymentStatus} history={order.statusHistory} />
        </div>
        <aside className="orders-detail-sidebar">
          <h2>Price breakdown</h2>
          <dl className="orders-price-breakdown">
            <div><dt>Subtotal</dt><dd>₹{order.subtotal.toFixed(2)}</dd></div>
            <div><dt>Discount</dt><dd>₹{order.discount.toFixed(2)}</dd></div>
            <div><dt>Shipping</dt><dd>₹{order.shippingCharges.toFixed(2)}</dd></div>
            <div><dt>Tax</dt><dd>₹{order.tax.toFixed(2)}</dd></div>
            <div><dt>Total</dt><dd>₹{order.totalAmount.toFixed(2)}</dd></div>
          </dl>
          <p>{totalQty} units across {order.items.length} line item(s)</p>
        </aside>
      </section>

      <section>
        <h2>Products</h2>
        <ul className="orders-line-items">
          {order.items.map((item) => (
            <li key={`${item.productName}-${item.sku}-${item.quantity}`}>
              <div className="orders-card-thumb">
                {item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="72px" className="cover-image" /> : null}
              </div>
              <div>
                <strong>{item.productName}</strong>
                <small>SKU {item.sku}</small>
                <p>{item.quantity} × ₹{item.unitPrice.toFixed(2)}</p>
              </div>
              <strong>₹{item.lineTotal.toFixed(2)}</strong>
            </li>
          ))}
        </ul>
      </section>

      <section className="orders-detail-grid">
        <div>
          <h2>Delivery address</h2>
          <p>{order.shippingAddress.fullName}</p>
          <p>{order.shippingAddress.addressLine1}</p>
          <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}</p>
          <p>{order.shippingAddress.phone}</p>
        </div>
        <div>
          <h2>Payment</h2>
          <p>Method: {order.paymentMethod ?? payment?.method ?? "—"}</p>
          <p>Status: {order.paymentStatus}</p>
          {payment?.razorpayPaymentId ? <p>Reference: {payment.razorpayPaymentId}</p> : null}
          {payment?.capturedAt ? <p>Paid: {new Date(payment.capturedAt).toLocaleString()}</p> : null}
        </div>
      </section>

      <section id="tracking">
        <h2>Shipment tracking</h2>
        {!order.shipment?.awb ? (
          <PendingCard title="AWB not assigned" description="Courier tracking will appear here once your shipment is booked and an AWB is assigned." />
        ) : (
          <>
            <p>
              {order.shipment.carrier ?? "Delhivery"} · AWB <strong>{order.shipment.awb}</strong>
            </p>
            {order.shipment.status ? <p>Shipment status: {order.shipment.status}</p> : null}
            {order.shipment.estimatedDelivery ? (
              <p>Estimated delivery: {new Date(order.shipment.estimatedDelivery).toLocaleDateString()}</p>
            ) : null}
            {order.shipment.trackingFetchedAt ? (
              <small>Last updated: {new Date(String(order.shipment.trackingFetchedAt)).toLocaleString()}</small>
            ) : null}
            <LoadingButton type="button" variant="secondary" loading={trackingLoading} onClick={() => void runTracking()}>
              Refresh tracking
            </LoadingButton>
            {trackingMessage ? <WarningCard title="Tracking unavailable" description={trackingMessage} /> : null}
            {Array.isArray(tracking?.events) && tracking.events.length > 0 ? (
              <ol className="order-tracking-events">
                {(tracking.events as { status?: string; location?: string; at?: string; remarks?: string }[]).map((event, index) => (
                  <li key={`${event.status}-${index}`}>
                    <strong>{event.status}</strong>
                    {event.location ? <span>{event.location}</span> : null}
                    {event.remarks ? <span>{event.remarks}</span> : null}
                    {event.at ? <small>{new Date(event.at).toLocaleString()}</small> : null}
                  </li>
                ))}
              </ol>
            ) : !trackingMessage && !trackingLoading ? (
              <PendingCard title="Tracking in progress" description="Refresh to load the latest courier scan events." />
            ) : null}
          </>
        )}
      </section>

      <OrderDetailReviewsSection orderId={order._id} orderStatus={order.orderStatus} />

      {canCancel ? (
        <section className="orders-action-panel">
          <h2>Cancel order</h2>
          <textarea value={cancelReason} onChange={(event) => setCancelReason(event.currentTarget.value)} placeholder="Cancellation reason" rows={3} />
          <LoadingButton type="button" variant="destructive" loading={cancelling} onClick={() => void runCancel()}>Cancel order</LoadingButton>
        </section>
      ) : null}

      {canReturn ? (
        <section className="orders-action-panel">
          <h2>Request return</h2>
          <textarea value={returnReason} onChange={(event) => setReturnReason(event.currentTarget.value)} placeholder="Return reason" rows={3} />
          <textarea value={returnRemarks} onChange={(event) => setReturnRemarks(event.currentTarget.value)} placeholder="Optional remarks" rows={2} />
          <LoadingButton type="button" loading={returning} onClick={() => void runReturn()}>Submit return request</LoadingButton>
        </section>
      ) : null}
    </main>
  );
}
