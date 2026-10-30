"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import LoadingButton from "@/components/ui/buttons/LoadingButton";
import TableSkeleton from "@/components/ui/loaders/TableSkeleton";
import { useApiRequest } from "@/hooks/useApiRequest";

type ServiceRequestRow = {
  _id: string;
  type: string;
  status: string;
  reason: string;
  createdAt: string;
  customer?: { name?: string; email?: string };
  order?: { orderNumber?: string; totalAmount?: number; paymentStatus?: string; orderStatus?: string };
};

export default function AdminReturnsClient() {
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const endpoint = useMemo(() => {
    const params = new URLSearchParams({ limit: "30" });
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    return `/api/v1/admin/service-requests?${params.toString()}`;
  }, [type, status]);

  const summaryRequest = useApiRequest<Record<string, number>>("/api/v1/admin/service-requests?summary=1");
  const listRequest = useApiRequest<ServiceRequestRow[]>(endpoint);

  if (listRequest.loading && !listRequest.data) return <TableSkeleton rows={8} />;

  const summary = summaryRequest.data ?? {};
  const rows = listRequest.data ?? [];

  return (
    <div className="admin-page">
      <AdminPageHeading eyebrow="Operations" title="Returns & cancellations" description="Review customer service requests and refunds." />
      <div className="orders-summary-grid admin-orders-summary">
        {Object.entries(summary).slice(0, 6).map(([key, value]) => (
          <article key={key}><strong>{value}</strong><span>{key.replaceAll("_", " ")}</span></article>
        ))}
      </div>
      <div className="orders-toolbar">
        <label>
          Type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All</option>
            <option value="return">Return</option>
            <option value="cancellation">Cancellation</option>
          </select>
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="requested">Requested</option>
            <option value="under_review">Under review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="refund_pending">Refund pending</option>
            <option value="completed">Completed</option>
          </select>
        </label>
        <LoadingButton type="button" variant="secondary" onClick={() => void listRequest.refetch()} loading={listRequest.loading}>
          Refresh
        </LoadingButton>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Order</th>
              <th>Customer</th>
              <th>Type</th>
              <th>Status</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row._id}>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
                <td>{row.order?.orderNumber ?? "—"}</td>
                <td>{row.customer?.name ?? "—"}</td>
                <td>{row.type}</td>
                <td><span className="admin-status-chip">{row.status}</span></td>
                <td><Link href={`/admin/returns/${row._id}`}>{row.reason || "Open"}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
