"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useFeedback } from "@/components/feedback/feedback-provider";
import Button from "@/components/ui/button";
import ErrorCard from "@/components/ui/feedback/error-card";
import PendingCard from "@/components/ui/feedback/pending-card";
import WarningCard from "@/components/ui/feedback/warning-card";
import DownloadInvoiceButton from "@/components/orders/download-invoice-button";
import OrderDetailReviewsSection from "@/components/reviews/order-detail-reviews-section";
import LoadingButton from "@/components/ui/buttons/loading-button";
import { OrderDetailSkeleton } from "@/components/ui/loaders/order-list-skeleton";
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
import { useAsyncAction } from "@/hooks/use-async-action";
import { formatDate, formatDateTime, formatRupees, humanizeStatus } from "@/lib/format";

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

  const load = useCallback(async () => {
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
  }, [orderId, router]);

  useEffect(() => {
    void load(); // eslint-disable-line react-hooks/set-state-in-effect -- fetch order on mount
  }, [load]);

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
      <div className="account-page">
        <ErrorCard
          title="Order unavailable"
          description={error || "This order could not be found."}
          action={<Button href="/account/orders" size="sm">Back to orders</Button>}
        />
      </div>
    );
  }

  const totalQty = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const canCancel =
    order.orderStatus !== "cancelled" &&
    !["shipped", "out_for_delivery", "delivered", "return_requested", "returned"].includes(order.orderStatus);
  const canReturn = order.orderStatus === "delivered";
  const address = order.shippingAddress ?? {};
  const trackingEvents = Array.isArray(tracking?.events)
    ? (tracking.events as { status?: string; location?: string; at?: string; remarks?: string }[])
    : [];

  return (
    <div className="account-page">
      <Link className="account-back-link" href="/account/orders">
        <ArrowLeft size={14} aria-hidden="true" /> All orders
      </Link>
      <div className="commerce-heading">
        <div>
          <p className="eyebrow">Order details</p>
          <h1>{order.orderNumber}</h1>
          <p className="account-lead">Placed {formatDateTime(order.createdAt)}</p>
        </div>
        <div className="account-heading-actions">
          <div className="orders-card-badges">
            <OrderStatusBadge kind="order" status={order.orderStatus} />
            <OrderStatusBadge kind="payment" status={order.paymentStatus} />
          </div>
          {order.paymentStatus !== "pending" ? <DownloadInvoiceButton orderId={order._id} /> : null}
        </div>
      </div>

      <div className="account-notices">
        {order.paymentStatus === "pending" ? (
          <PendingCard
            className="feedback-card--compact"
            title="Payment pending"
            description="This order is waiting for a confirmed payment. If you have already paid, refresh the status."
            action={
              <LoadingButton type="button" variant="secondary" size="sm" loading={refreshingPayment} onClick={() => void runRefreshPayment()}>
                Refresh payment status
              </LoadingButton>
            }
          />
        ) : null}
        {order.orderStatus === "cancelled" ? (
          <WarningCard
            className="feedback-card--compact"
            title="Order cancelled"
            description={order.cancellation?.reason ? `Reason: ${order.cancellation.reason}` : "This order was cancelled."}
          />
        ) : null}
        {order.orderStatus === "cancelled" && order.cancellationRefund?.status && order.cancellationRefund.status !== "none" ? (
          <PendingCard
            className="feedback-card--compact"
            title={`Refund ${humanizeStatus(order.cancellationRefund.status).toLowerCase()}`}
            description={order.cancellationRefund.message || "Refund status updates automatically once our payment provider confirms it."}
          />
        ) : null}
      </div>

      <div className="account-detail-layout">
        <div className="account-detail-main">
          <section className="account-panel">
            <h2>Order progress</h2>
            <OrderTimeline orderStatus={order.orderStatus} paymentStatus={order.paymentStatus} history={order.statusHistory} />
          </section>

          <section className="account-panel">
            <div className="account-panel-head">
              <h2>Products</h2>
              <span>{order.items.length} {order.items.length === 1 ? "line" : "lines"} · {totalQty} units</span>
            </div>
            <ul className="orders-line-items">
              {order.items.map((item) => (
                <li key={`${item.productName}-${item.sku}-${item.quantity}`}>
                  <div className="orders-line-thumb">
                    {item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="64px" className="cover-image" /> : null}
                  </div>
                  <div className="orders-line-copy">
                    <strong>{item.productName}</strong>
                    <small>SKU {item.sku}</small>
                    <small>{item.quantity} × {formatRupees(item.unitPrice)}</small>
                  </div>
                  <strong className="orders-line-total">{formatRupees(item.lineTotal)}</strong>
                </li>
              ))}
            </ul>
          </section>

          <section className="account-panel" id="tracking">
            <div className="account-panel-head">
              <h2>Shipment tracking</h2>
              {order.shipment?.awb ? (
                <LoadingButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<RefreshCw size={13} aria-hidden="true" />}
                  loading={trackingLoading}
                  onClick={() => void runTracking()}
                >
                  Refresh
                </LoadingButton>
              ) : null}
            </div>
            {!order.shipment?.awb ? (
              <p className="account-muted">
                Courier tracking appears here once your shipment is booked and an AWB number is assigned.
              </p>
            ) : (
              <>
                <dl className="account-facts">
                  <div><dt>Carrier</dt><dd>{order.shipment.carrier ?? "Delhivery"}</dd></div>
                  <div><dt>AWB</dt><dd>{order.shipment.awb}</dd></div>
                  {order.shipment.status ? <div><dt>Status</dt><dd>{humanizeStatus(order.shipment.status)}</dd></div> : null}
                  {order.shipment.estimatedDelivery ? (
                    <div><dt>Estimated delivery</dt><dd>{formatDate(order.shipment.estimatedDelivery)}</dd></div>
                  ) : null}
                </dl>
                {trackingMessage ? (
                  <WarningCard className="feedback-card--compact" title="Tracking unavailable" description={trackingMessage} />
                ) : null}
                {trackingEvents.length > 0 ? (
                  <ol className="order-tracking-events">
                    {trackingEvents.map((event, index) => (
                      <li key={`${event.status}-${index}`}>
                        <strong>{event.status}</strong>
                        {event.location || event.remarks ? (
                          <span>{[event.location, event.remarks].filter(Boolean).join(" · ")}</span>
                        ) : null}
                        {event.at ? <small>{formatDateTime(event.at)}</small> : null}
                      </li>
                    ))}
                  </ol>
                ) : !trackingMessage && !trackingLoading ? (
                  <p className="account-muted">No courier scans yet. Use Refresh to fetch the latest events.</p>
                ) : null}
                {order.shipment.trackingFetchedAt ? (
                  <p className="account-footnote">Last updated {formatDateTime(String(order.shipment.trackingFetchedAt))}</p>
                ) : null}
              </>
            )}
          </section>

          <OrderDetailReviewsSection orderId={order._id} orderStatus={order.orderStatus} />

          {canCancel ? (
            <section className="account-panel">
              <h2>Cancel order</h2>
              <p className="account-muted">Paid orders are refunded to the original payment method once cancellation is confirmed.</p>
              <label className="account-field">
                Reason for cancelling
                <textarea value={cancelReason} onChange={(event) => setCancelReason(event.currentTarget.value)} rows={3} maxLength={500} />
              </label>
              <div className="account-panel-actions">
                <LoadingButton type="button" variant="destructive" size="sm" loading={cancelling} onClick={() => void runCancel()}>
                  Cancel order
                </LoadingButton>
              </div>
            </section>
          ) : null}

          {canReturn ? (
            <section className="account-panel">
              <h2>Request a return</h2>
              <p className="account-muted">Our team reviews every return request and updates you on this page.</p>
              <label className="account-field">
                Reason for return
                <textarea value={returnReason} onChange={(event) => setReturnReason(event.currentTarget.value)} rows={3} maxLength={500} />
              </label>
              <label className="account-field">
                Additional remarks <small>(optional)</small>
                <textarea value={returnRemarks} onChange={(event) => setReturnRemarks(event.currentTarget.value)} rows={2} maxLength={2000} />
              </label>
              <div className="account-panel-actions">
                <LoadingButton type="button" size="sm" loading={returning} onClick={() => void runReturn()}>
                  Submit return request
                </LoadingButton>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="account-detail-aside">
          <section className="account-panel">
            <h2>Order summary</h2>
            <dl className="orders-price-breakdown">
              <div><dt>Subtotal</dt><dd>{formatRupees(order.subtotal)}</dd></div>
              {order.discount ? <div><dt>Discount</dt><dd>−{formatRupees(order.discount)}</dd></div> : null}
              <div><dt>Shipping</dt><dd>{order.shippingCharges ? formatRupees(order.shippingCharges) : "Free"}</dd></div>
              <div><dt>Tax</dt><dd>{formatRupees(order.tax)}</dd></div>
              <div className="is-total"><dt>Total</dt><dd>{formatRupees(order.totalAmount)}</dd></div>
            </dl>
          </section>

          <section className="account-panel">
            <h2>Delivery address</h2>
            <address className="account-address">
              <strong>{address.fullName}</strong>
              {address.addressLine1 ? <span>{address.addressLine1}</span> : null}
              {address.addressLine2 ? <span>{address.addressLine2}</span> : null}
              <span>{[address.city, address.state, address.pincode].filter(Boolean).join(", ")}</span>
              {address.phone ? <span>{address.phone}</span> : null}
            </address>
          </section>

          <section className="account-panel">
            <h2>Payment</h2>
            <dl className="account-facts is-stacked">
              <div><dt>Method</dt><dd>{humanizeStatus(order.paymentMethod ?? payment?.method)}</dd></div>
              <div><dt>Status</dt><dd>{humanizeStatus(order.paymentStatus)}</dd></div>
              {payment?.razorpayPaymentId ? <div><dt>Reference</dt><dd className="is-code">{payment.razorpayPaymentId}</dd></div> : null}
              {payment?.capturedAt ? <div><dt>Paid on</dt><dd>{formatDateTime(payment.capturedAt)}</dd></div> : null}
            </dl>
          </section>

          <p className="account-help">
            Need help with this order? <Link href="/contact">Contact support</Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
