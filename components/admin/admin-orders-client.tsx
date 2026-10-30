"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import EmptyState from "@/components/ui/empty-state";
import ErrorCard from "@/components/ui/feedback/ErrorCard";
import LoadingButton from "@/components/ui/buttons/LoadingButton";
import TableSkeleton from "@/components/ui/loaders/TableSkeleton";
import OrderStatusBadge from "@/features/orders/order-status-badge";
import { useApiRequest } from "@/hooks/useApiRequest";
import type { OrderListItem, OrderSummaryStats } from "@/features/orders/types";

export default function AdminOrdersClient() {
  const feedback = useFeedback();
  const [q, setQ] = useState("");
  const [bucket, setBucket] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("");
  const query = useMemo(() => {
    const params = new URLSearchParams({ limit: "25", page: "1" });
    if (q.trim()) params.set("q", q.trim());
    if (bucket !== "all") params.set("bucket", bucket);
    if (paymentStatus) params.set("paymentStatus", paymentStatus);
    return `/api/v1/orders?${params.toString()}`;
  }, [bucket, paymentStatus, q]);

  const summaryRequest = useApiRequest<OrderSummaryStats>("/api/v1/orders/summary");
  const listRequest = useApiRequest<OrderListItem[]>(query, {}, { immediate: true });
  const orders = listRequest.data ?? [];
  const summary = summaryRequest.data;

  return (
    <>
      <AdminPageHeading
        eyebrow="Commerce"
        title="Orders"
        description="Search, review, and fulfill wholesale customer orders."
        action={
          <LoadingButton type="button" variant="secondary" loading={listRequest.loading} onClick={() => void listRequest.refetch()}>
            Refresh
          </LoadingButton>
        }
      />
      {summary ? (
        <div className="orders-summary-grid admin-orders-summary">
          <article><strong>{summary.total}</strong><span>Total</span></article>
          <article><strong>{summary.pendingPayment}</strong><span>Pending payment</span></article>
          <article><strong>{summary.paid}</strong><span>Paid</span></article>
          <article><strong>{summary.processing}</strong><span>Processing</span></article>
          <article><strong>{summary.shipped}</strong><span>Shipped</span></article>
          <article><strong>{summary.delivered}</strong><span>Delivered</span></article>
          <article><strong>{summary.cancelled}</strong><span>Cancelled</span></article>
        </div>
      ) : null}
      <div className="orders-toolbar">
        <input value={q} onChange={(event) => setQ(event.currentTarget.value)} placeholder="Search order or product" />
        <select value={bucket} onChange={(event) => setBucket(event.currentTarget.value)}>
          <option value="all">All statuses</option>
          <option value="pending_payment">Pending payment</option>
          <option value="confirmed">Confirmed</option>
          <option value="processing">Processing</option>
          <option value="packed">Packed</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.currentTarget.value)}>
          <option value="">All payments</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
        <LoadingButton type="button" onClick={() => { void listRequest.refetch(); feedback.info("Filters applied", "Order list refreshed."); }}>
          Apply
        </LoadingButton>
      </div>
      {listRequest.loading ? <TableSkeleton rows={8} /> : null}
      {listRequest.error ? (
        <ErrorCard title="Unable to load orders" description={listRequest.error} action={<LoadingButton type="button" onClick={() => void listRequest.refetch()}>Try again</LoadingButton>} />
      ) : null}
      {!listRequest.loading && orders.length === 0 ? (
        <EmptyState title="No orders found" description="Orders appear here after customers checkout." />
      ) : null}
      {!listRequest.loading && orders.length > 0 ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Items</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
                <th>AWB</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order._id}>
                  <td>{order.orderNumber}</td>
                  <td>{new Date(order.createdAt).toLocaleString()}</td>
                  <td>{order.items.length}</td>
                  <td>₹{order.totalAmount.toFixed(2)}</td>
                  <td><OrderStatusBadge kind="payment" status={order.paymentStatus} /></td>
                  <td><OrderStatusBadge kind="order" status={order.orderStatus} /></td>
                  <td>{order.shipment?.awb ?? "—"}</td>
                  <td><Link className="admin-text-link" href={`/admin/orders/${order._id}`}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
