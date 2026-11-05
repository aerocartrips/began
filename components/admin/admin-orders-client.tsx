"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import AdminStatusChip from "@/components/admin/admin-status-chip";
import AdminSummaryGrid from "@/components/admin/admin-summary-grid";
import ErrorCard from "@/components/ui/feedback/error-card";
import LoadingButton from "@/components/ui/buttons/loading-button";
import Select, { toSelectOptions } from "@/components/ui/form/select";
import TableSkeleton from "@/components/ui/loaders/table-skeleton";
import { useApiRequest } from "@/hooks/use-api-request";
import { formatDateTime, formatNumber, formatRupees } from "@/lib/format";
import type { OrderListItem, OrderSummaryStats } from "@/features/orders/types";

const STATUS_OPTIONS = toSelectOptions([
  ["all", "All statuses"],
  ["pending_payment", "Pending payment"],
  ["confirmed", "Confirmed"],
  ["processing", "Processing"],
  ["packed", "Packed"],
  ["shipped", "Shipped"],
  ["delivered", "Delivered"],
  ["cancelled", "Cancelled"],
]);

const PAYMENT_OPTIONS = toSelectOptions([
  ["", "All payments"],
  ["pending", "Pending"],
  ["paid", "Paid"],
  ["failed", "Failed"],
  ["refunded", "Refunded"],
]);

export default function AdminOrdersClient() {
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [bucket, setBucket] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("");

  const endpoint = useMemo(() => {
    const params = new URLSearchParams({ limit: "25", page: "1" });
    if (appliedSearch.trim()) params.set("q", appliedSearch.trim());
    if (bucket !== "all") params.set("bucket", bucket);
    if (paymentStatus) params.set("paymentStatus", paymentStatus);
    return `/api/v1/orders?${params.toString()}`;
  }, [appliedSearch, bucket, paymentStatus]);

  const summaryRequest = useApiRequest<OrderSummaryStats>("/api/v1/orders/summary");
  const listRequest = useApiRequest<OrderListItem[]>(endpoint);
  const orders = listRequest.data ?? [];
  const summary = summaryRequest.data;

  function applySearch(event: FormEvent) {
    event.preventDefault();
    if (search === appliedSearch) void listRequest.refetch();
    else setAppliedSearch(search);
  }

  return (
    <>
      <AdminPageHeading
        eyebrow="Commerce"
        title="Orders"
        description="Search, review, and fulfil wholesale customer orders."
        action={
          <LoadingButton
            type="button"
            variant="secondary"
            loading={listRequest.loading}
            onClick={() => {
              void listRequest.refetch();
              void summaryRequest.refetch();
            }}
          >
            Refresh
          </LoadingButton>
        }
      />

      {summary ? (
        <AdminSummaryGrid
          label="Order summary"
          items={[
            { label: "Total orders", value: formatNumber(summary.total) },
            { label: "Pending payment", value: formatNumber(summary.pendingPayment) },
            { label: "Paid", value: formatNumber(summary.paid) },
            { label: "Processing", value: formatNumber(summary.processing) },
            { label: "Shipped", value: formatNumber(summary.shipped) },
            { label: "Delivered", value: formatNumber(summary.delivered) },
            { label: "Cancelled", value: formatNumber(summary.cancelled) },
          ]}
        />
      ) : null}

      <form className="admin-toolbar" onSubmit={applySearch} role="search">
        <label className="admin-toolbar__search">
          <span className="sr-only">Search orders</span>
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder="Search order number or product…"
          />
        </label>
        <Select label="Order status" hideLabel options={STATUS_OPTIONS} value={bucket} onChange={setBucket} />
        <Select label="Payment status" hideLabel options={PAYMENT_OPTIONS} value={paymentStatus} onChange={setPaymentStatus} />
        <LoadingButton type="submit" variant="secondary" loading={listRequest.loading}>
          Apply
        </LoadingButton>
      </form>

      {listRequest.error ? (
        <ErrorCard
          title="Unable to load orders"
          description={listRequest.error}
          action={<LoadingButton type="button" onClick={() => void listRequest.refetch()}>Try again</LoadingButton>}
        />
      ) : listRequest.loading && orders.length === 0 ? (
        <TableSkeleton rows={8} />
      ) : orders.length === 0 ? (
        <div className="admin-empty-results" role="status">
          No orders match these filters. Orders appear here after customers check out.
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Placed</th>
                <th scope="col">Items</th>
                <th scope="col" className="is-numeric">Total</th>
                <th scope="col">Payment</th>
                <th scope="col">Fulfilment</th>
                <th scope="col">AWB</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
                return (
                  <tr key={order._id}>
                    <td>
                      <span className="admin-cell-stack">
                        <strong>{order.orderNumber}</strong>
                        <small>{order.items[0]?.productName ?? "—"}</small>
                      </span>
                    </td>
                    <td>{formatDateTime(order.createdAt)}</td>
                    <td>{order.items.length} {order.items.length === 1 ? "line" : "lines"} · {formatNumber(units)} units</td>
                    <td className="is-numeric"><strong>{formatRupees(order.totalAmount)}</strong></td>
                    <td><AdminStatusChip status={order.paymentStatus} /></td>
                    <td><AdminStatusChip status={order.orderStatus} /></td>
                    <td>{order.shipment?.awb ? <code>{order.shipment.awb}</code> : <span className="admin-muted-text">—</span>}</td>
                    <td className="is-action">
                      <Link className="admin-text-link" href={`/admin/orders/${order._id}`}>View</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
