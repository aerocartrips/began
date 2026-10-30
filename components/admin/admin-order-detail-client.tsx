"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import ErrorCard from "@/components/ui/feedback/ErrorCard";
import LoadingButton from "@/components/ui/buttons/LoadingButton";
import DownloadInvoiceButton from "@/components/orders/download-invoice-button";
import { OrderDetailSkeleton } from "@/components/ui/loaders/OrderListSkeleton";
import OrderStatusBadge from "@/features/orders/order-status-badge";
import OrderTimeline from "@/features/orders/order-timeline";
import { useApiRequest } from "@/hooks/useApiRequest";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { apiRequest } from "@/lib/api/api-client";
import type { OrderDetail, OrderPaymentInfo } from "@/features/orders/types";

type AdminOrderDetailClientProps = { orderId: string };

export default function AdminOrderDetailClient({ orderId }: AdminOrderDetailClientProps) {
  const feedback = useFeedback();
  const endpoint = useMemo(() => `/api/v1/orders/${encodeURIComponent(orderId)}`, [orderId]);
  const { loading, error, data, refetch } = useApiRequest<{ order: OrderDetail; payment: OrderPaymentInfo | null }>(endpoint);
  const order = data?.order;
  const payment = data?.payment;
  const [orderStatus, setOrderStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [customerVisibleRemark, setCustomerVisibleRemark] = useState("");
  const [shipmentAwb, setShipmentAwb] = useState("");
  const [remarks, setRemarks] = useState("");

  const { run: save, loading: saving } = useAsyncAction(async () => {
    if (!order) return null;
    await apiRequest(`${endpoint}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderStatus: orderStatus || undefined,
        paymentStatus: paymentStatus || undefined,
        internalNotes,
        customerVisibleRemark,
        shipmentAwb: shipmentAwb || undefined,
        remarks,
      }),
    });
    feedback.success("Order updated", `Saved changes for ${order.orderNumber}.`);
    await refetch();
    return null;
  });

  if (loading && !order) return <OrderDetailSkeleton />;
  if (error || !order) {
    return (
      <ErrorCard
        title="Unable to load order"
        description={error || "Order not found."}
        action={<LoadingButton type="button" onClick={() => void refetch()}>Try again</LoadingButton>}
      />
    );
  }

  return (
    <>
      <AdminPageHeading
        eyebrow="Order record"
        title={order.orderNumber}
        description={`Placed ${new Date(order.createdAt).toLocaleString()}`}
        action={<Link className="admin-text-link" href="/admin/orders">Back to orders</Link>}
      />
      <div className="orders-detail-badges">
        <OrderStatusBadge kind="order" status={order.orderStatus} />
        <OrderStatusBadge kind="payment" status={order.paymentStatus} />
      </div>
      {order.paymentStatus !== "pending" ? (
        <div className="orders-detail-actions">
          <DownloadInvoiceButton orderId={order._id} />
        </div>
      ) : null}
      <OrderTimeline orderStatus={order.orderStatus} paymentStatus={order.paymentStatus} history={order.statusHistory} />
      <section className="admin-order-status-form">
        <h2>Shipment</h2>
        <p>Booking: {order.shipment?.bookingStatus ?? "not_created"}</p>
        <p>AWB: {order.shipment?.awb || "—"}</p>
        <p>LR: {order.shipment?.lrNumber || "—"}</p>
        <p>Manifest: {order.shipment?.manifestStatus || "—"}</p>
        <div className="orders-detail-actions">
          <LoadingButton
            type="button"
            variant="secondary"
            onClick={async () => {
              await apiRequest(`/api/v1/admin/orders/${orderId}/shipment`, { method: "POST" });
              feedback.success("Shipment", "Booking request submitted.");
              await refetch();
            }}
          >
            Create shipment
          </LoadingButton>
          <LoadingButton
            type="button"
            variant="secondary"
            onClick={async () => {
              await apiRequest(`/api/v1/admin/orders/${orderId}/shipment?action=manifest`, { method: "POST" });
              feedback.success("Manifest", "Manifest request submitted.");
              await refetch();
            }}
          >
            Generate manifest
          </LoadingButton>
          <LoadingButton
            type="button"
            variant="secondary"
            onClick={async () => {
              await apiRequest(`/api/v1/admin/orders/${orderId}/shipment?action=refresh-tracking`, { method: "POST" });
              feedback.success("Tracking", "Tracking refreshed.");
              await refetch();
            }}
          >
            Refresh tracking
          </LoadingButton>
        </div>
      </section>
      <section className="admin-order-status-form">
        <label>Fulfillment status<select value={orderStatus || order.orderStatus} onChange={(e) => setOrderStatus(e.target.value)}><option value="confirmed">confirmed</option><option value="processing">processing</option><option value="packed">packed</option><option value="shipped">shipped</option><option value="out_for_delivery">out_for_delivery</option><option value="delivered">delivered</option><option value="cancelled">cancelled</option><option value="return_requested">return_requested</option><option value="returned">returned</option></select></label>
        <label>Payment status<select value={paymentStatus || order.paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}><option value="pending">pending</option><option value="paid">paid</option><option value="failed">failed</option><option value="refunded">refunded</option><option value="partially_refunded">partially_refunded</option></select></label>
        <label>Shipment AWB<input value={shipmentAwb || order.shipment?.awb || ""} onChange={(e) => setShipmentAwb(e.target.value)} /></label>
        <label>Internal notes<textarea value={internalNotes || order.internalNotes || ""} onChange={(e) => setInternalNotes(e.target.value)} rows={3} /></label>
        <label>Customer-visible remark<textarea value={customerVisibleRemark || order.customerVisibleRemark || ""} onChange={(e) => setCustomerVisibleRemark(e.target.value)} rows={2} /></label>
        <label>Admin remarks<textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} /></label>
        <LoadingButton type="button" loading={saving} loadingText="Saving..." onClick={() => void save()}>Save changes</LoadingButton>
      </section>
      <section>
        <h2>Payment</h2>
        <p>{payment?.razorpayPaymentId ?? "No Razorpay payment ID yet"}</p>
        <p>{payment?.status ?? order.paymentStatus}</p>
      </section>
      <section>
        <h2>Status history</h2>
        <ul className="admin-order-history">
          {(order.statusHistory ?? []).slice().reverse().map((entry, index) => (
            <li key={index}>
              <strong>{entry.newOrderStatus ?? entry.newPaymentStatus}</strong>
              <small>{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ""}</small>
              <p>{entry.customerVisibleRemark || entry.remarks}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
