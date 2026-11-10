"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useFeedback } from "@/components/feedback/feedback-provider";
import AdminCard, { AdminDetailList } from "@/components/admin/admin-card";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import AdminStatusChip from "@/components/admin/admin-status-chip";
import ErrorCard from "@/components/ui/feedback/error-card";
import LoadingButton from "@/components/ui/buttons/loading-button";
import Select, { type SelectOption } from "@/components/ui/form/select";
import DownloadInvoiceButton from "@/components/orders/download-invoice-button";
import { OrderDetailSkeleton } from "@/components/ui/loaders/order-list-skeleton";
import OrderTimeline from "@/features/orders/order-timeline";
import { useApiRequest } from "@/hooks/use-api-request";
import { useAsyncAction } from "@/hooks/use-async-action";
import { apiRequest } from "@/lib/api/api-client";
import { formatDateTime, formatNumber, formatRupees, humanizeStatus } from "@/lib/format";
import { hasInvoice } from "@/lib/constants/order-status";
import { FULFILLMENT_TRANSITIONS, MANUAL_PAYMENT_TRANSITIONS } from "@/lib/constants/order-transitions";
import type { OrderDetail, OrderPaymentInfo } from "@/features/orders/types";

const statusOptions = (statuses: readonly string[]): SelectOption[] =>
  statuses.map((status) => ({ id: status, label: humanizeStatus(status) }));

/** The current status plus the moves the server accepts from it (lib/constants/order-transitions.js). */
const nextStatuses = (current: string, transitions: Record<string, readonly string[] | undefined>) =>
  statusOptions([current, ...(transitions[current] ?? [])]);

type ShipmentAction = "create" | "manifest" | "refresh-tracking";

const SHIPMENT_ACTIONS: Record<ShipmentAction, { label: string; query: string; done: string }> = {
  create: { label: "Create shipment", query: "", done: "Booking request submitted." },
  manifest: { label: "Generate manifest", query: "?action=manifest", done: "Manifest request submitted." },
  "refresh-tracking": { label: "Refresh tracking", query: "?action=refresh-tracking", done: "Tracking refreshed." },
};

export default function AdminOrderDetailClient({ orderId }: { orderId: string }) {
  const feedback = useFeedback();
  const endpoint = useMemo(() => `/api/v1/orders/${encodeURIComponent(orderId)}`, [orderId]);
  const { loading, error, data, refetch } = useApiRequest<{ order: OrderDetail; payment: OrderPaymentInfo | null }>(endpoint);
  const order = data?.order;
  const payment = data?.payment;
  const [pendingShipmentAction, setPendingShipmentAction] = useState<ShipmentAction | null>(null);

  const { run: runShipmentAction } = useAsyncAction(async (action: ShipmentAction) => {
    setPendingShipmentAction(action);
    try {
      await apiRequest(`/api/v1/admin/orders/${encodeURIComponent(orderId)}/shipment${SHIPMENT_ACTIONS[action].query}`, {
        method: "POST",
      });
      feedback.success(SHIPMENT_ACTIONS[action].label, SHIPMENT_ACTIONS[action].done);
      await refetch();
    } catch (shipmentError) {
      feedback.error(
        `${SHIPMENT_ACTIONS[action].label} failed`,
        shipmentError instanceof Error ? shipmentError.message : "Try again in a moment.",
      );
    } finally {
      setPendingShipmentAction(null);
    }
    return null;
  });

  if (loading && !order) return <OrderDetailSkeleton inline />;
  if (error || !order) {
    return (
      <ErrorCard
        title="Unable to load order"
        description={error || "Order not found."}
        action={<LoadingButton type="button" onClick={() => void refetch()}>Try again</LoadingButton>}
      />
    );
  }

  const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const address = order.shippingAddress ?? {};
  const history = (order.statusHistory ?? []).slice().reverse();

  return (
    <>
      <AdminPageHeading
        eyebrow="Order record"
        title={order.orderNumber}
        description={`Placed ${formatDateTime(order.createdAt)} · ${order.items.length} ${order.items.length === 1 ? "line" : "lines"} · ${formatNumber(units)} units`}
        action={
          <Link className="admin-back-link" href="/admin/orders">
            <ArrowLeft size={14} aria-hidden="true" /> All orders
          </Link>
        }
      />

      <div className="admin-detail-layout">
        <div className="admin-detail-main">
          <AdminCard title="Line items">
            <div className="admin-table-wrap is-flush">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col" className="is-numeric">Qty</th>
                    <th scope="col" className="is-numeric">Unit price</th>
                    <th scope="col" className="is-numeric">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={`${item.sku}-${item.productName}`}>
                      <td>
                        <div className="admin-product-cell">
                          {item.imageUrl ? <Image src={item.imageUrl} alt="" width={40} height={48} unoptimized /> : null}
                          <span>
                            <strong>{item.productName}</strong>
                            <small>SKU {item.sku}</small>
                          </span>
                        </div>
                      </td>
                      <td className="is-numeric">{formatNumber(item.quantity)}</td>
                      <td className="is-numeric">{formatRupees(item.unitPrice)}</td>
                      <td className="is-numeric"><strong>{formatRupees(item.lineTotal)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminCard>

          <AdminCard title="Fulfilment progress">
            <OrderTimeline orderStatus={order.orderStatus} paymentStatus={order.paymentStatus} history={order.statusHistory} />
          </AdminCard>

          <OrderUpdateForm
            key={`${order.orderStatus}-${order.paymentStatus}-${order.statusHistory?.length ?? 0}`}
            order={order}
            endpoint={endpoint}
            onSaved={refetch}
          />

          <AdminCard title="Status history" description="Most recent first.">
            {history.length === 0 ? (
              <p className="admin-muted-text">No status changes recorded yet.</p>
            ) : (
              <ol className="admin-history">
                {history.map((entry, index) => (
                  <li key={`${entry.createdAt}-${index}`}>
                    <div>
                      <strong>{humanizeStatus(entry.newOrderStatus ?? entry.newPaymentStatus)}</strong>
                      <time>{formatDateTime(entry.createdAt, "")}</time>
                    </div>
                    {entry.remarks ? <p>{entry.remarks}</p> : null}
                    {entry.customerVisibleRemark && entry.customerVisibleRemark !== entry.remarks ? (
                      <p className="admin-muted-text">Customer was told: {entry.customerVisibleRemark}</p>
                    ) : null}
                    {entry.changedByLabel ? <p className="admin-muted-text">By {entry.changedByLabel}</p> : null}
                  </li>
                ))}
              </ol>
            )}
          </AdminCard>
        </div>

        <aside className="admin-detail-aside">
          <AdminCard
            title="Summary"
            action={hasInvoice(order.paymentStatus) ? <DownloadInvoiceButton orderId={order._id} size="sm" /> : null}
          >
            <div className="admin-chip-row">
              <AdminStatusChip status={order.orderStatus} />
              <AdminStatusChip status={order.paymentStatus} label={`Payment ${humanizeStatus(order.paymentStatus).toLowerCase()}`} />
            </div>
            <dl className="admin-totals">
              <div><dt>Subtotal</dt><dd>{formatRupees(order.subtotal)}</dd></div>
              <div><dt>Discount</dt><dd>−{formatRupees(order.discount)}</dd></div>
              <div><dt>Shipping</dt><dd>{formatRupees(order.shippingCharges)}</dd></div>
              <div><dt>Tax</dt><dd>{formatRupees(order.tax)}</dd></div>
              <div className="is-total"><dt>Total</dt><dd>{formatRupees(order.totalAmount)}</dd></div>
            </dl>
          </AdminCard>

          <AdminCard title="Ship to">
            <address className="admin-address">
              <strong>{address.fullName || "—"}</strong>
              {address.companyName ? <span>{address.companyName}</span> : null}
              {address.addressLine1 ? <span>{address.addressLine1}</span> : null}
              {address.addressLine2 ? <span>{address.addressLine2}</span> : null}
              <span>{[address.city, address.state, address.pincode].filter(Boolean).join(", ")}</span>
              {address.phone ? <span>{address.phone}</span> : null}
            </address>
          </AdminCard>

          {order.notes ? (
            <AdminCard title="Customer note">
              <p className="order-note">{order.notes}</p>
            </AdminCard>
          ) : null}

          <AdminCard title="Payment">
            <AdminDetailList
              items={[
                { label: "Status", value: <AdminStatusChip status={payment?.status ?? order.paymentStatus} /> },
                { label: "Method", value: humanizeStatus(order.paymentMethod ?? payment?.method) },
                { label: "Razorpay ID", value: payment?.razorpayPaymentId ? <code>{payment.razorpayPaymentId}</code> : "Not captured yet" },
                { label: "Captured", value: formatDateTime(payment?.capturedAt) },
              ]}
            />
          </AdminCard>

          <AdminCard title="Shipment">
            <AdminDetailList
              items={[
                { label: "Booking", value: <AdminStatusChip status={order.shipment?.bookingStatus ?? "not_created"} /> },
                { label: "AWB", value: order.shipment?.awb ? <code>{order.shipment.awb}</code> : null },
                { label: "LR number", value: order.shipment?.lrNumber },
                { label: "Manifest", value: humanizeStatus(order.shipment?.manifestStatus) },
              ]}
            />
            <div className="admin-button-stack">
              {(Object.keys(SHIPMENT_ACTIONS) as ShipmentAction[]).map((action) => (
                <LoadingButton
                  key={action}
                  type="button"
                  variant="secondary"
                  loading={pendingShipmentAction === action}
                  disabled={pendingShipmentAction !== null && pendingShipmentAction !== action}
                  onClick={() => void runShipmentAction(action)}
                >
                  {SHIPMENT_ACTIONS[action].label}
                </LoadingButton>
              ))}
            </div>
          </AdminCard>
        </aside>
      </div>
    </>
  );
}

type OrderUpdateFormProps = {
  order: OrderDetail;
  endpoint: string;
  onSaved: () => Promise<unknown>;
};

function OrderUpdateForm({ order, endpoint, onSaved }: OrderUpdateFormProps) {
  const feedback = useFeedback();
  const [orderStatus, setOrderStatus] = useState(order.orderStatus);
  const [paymentStatus, setPaymentStatus] = useState(order.paymentStatus);
  const [shipmentAwb, setShipmentAwb] = useState(order.shipment?.awb ?? "");
  const [internalNotes, setInternalNotes] = useState(order.internalNotes ?? "");
  const [customerVisibleRemark, setCustomerVisibleRemark] = useState(order.customerVisibleRemark ?? "");
  const [remarks, setRemarks] = useState("");

  const { run: save, loading: saving } = useAsyncAction(async () => {
    const cancelling = orderStatus === "cancelled" && order.orderStatus !== "cancelled";
    const markingPaid = paymentStatus === "paid" && order.paymentStatus !== "paid";
    if (cancelling && !window.confirm(
      order.paymentStatus === "paid"
        ? "Cancel this order? Its stock goes back on sale and the customer is refunded in full through Razorpay."
        : "Cancel this order? Its stock goes back on sale.",
    )) return null;
    if (markingPaid && !window.confirm("Mark this order as paid? Only do this for money received outside online checkout.")) return null;
    try {
      await apiRequest(`${endpoint}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderStatus: orderStatus !== order.orderStatus ? orderStatus : undefined,
          paymentStatus: paymentStatus !== order.paymentStatus ? paymentStatus : undefined,
          internalNotes,
          customerVisibleRemark,
          shipmentAwb: shipmentAwb.trim() || undefined,
          remarks,
        }),
      });
      feedback.success("Order updated", `Saved changes for ${order.orderNumber}.`);
      setRemarks("");
      await onSaved();
    } catch (saveError) {
      feedback.error("Could not save order", saveError instanceof Error ? saveError.message : "Try again.");
    }
    return null;
  });

  return (
    <AdminCard title="Update order" description="Status changes are recorded in the history and may notify the customer.">
      <form
        className="admin-form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Select
          className="admin-field"
          label="Fulfilment status"
          options={nextStatuses(order.orderStatus, FULFILLMENT_TRANSITIONS)}
          value={orderStatus}
          onChange={setOrderStatus}
        />
        <Select
          className="admin-field"
          label="Payment status"
          // Only "paid" can be set by hand (an offline payment); refunds use the refund action.
          options={nextStatuses(order.paymentStatus, MANUAL_PAYMENT_TRANSITIONS)}
          value={paymentStatus}
          onChange={setPaymentStatus}
        />
        <label className="admin-field admin-field-wide">
          Shipment AWB
          <input value={shipmentAwb} onChange={(event) => setShipmentAwb(event.currentTarget.value)} placeholder="Assigned by courier" />
        </label>
        <label className="admin-field">
          Internal notes
          <textarea value={internalNotes} onChange={(event) => setInternalNotes(event.currentTarget.value)} rows={3} placeholder="Visible to admins only" />
        </label>
        <label className="admin-field">
          Customer-visible remark
          <textarea value={customerVisibleRemark} onChange={(event) => setCustomerVisibleRemark(event.currentTarget.value)} rows={3} placeholder="Shown on the customer's order page" />
        </label>
        <label className="admin-field admin-field-wide">
          Change note
          <input value={remarks} onChange={(event) => setRemarks(event.currentTarget.value)} placeholder="Optional note stored with this status change" />
        </label>
        <div className="admin-form-actions admin-field-wide">
          <LoadingButton type="submit" loading={saving} loadingText="Saving…">Save changes</LoadingButton>
        </div>
      </form>
    </AdminCard>
  );
}
