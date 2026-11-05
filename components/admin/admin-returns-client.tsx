"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import AdminStatusChip from "@/components/admin/admin-status-chip";
import AdminSummaryGrid from "@/components/admin/admin-summary-grid";
import ErrorCard from "@/components/ui/feedback/error-card";
import LoadingButton from "@/components/ui/buttons/loading-button";
import Select, { toSelectOptions } from "@/components/ui/form/select";
import TableSkeleton from "@/components/ui/loaders/table-skeleton";
import { useApiRequest } from "@/hooks/use-api-request";
import { formatDateTime, formatNumber, formatRupees, humanizeStatus } from "@/lib/format";

type ServiceRequestRow = {
  _id: string;
  type: string;
  status: string;
  reason: string;
  createdAt: string;
  customer?: { name?: string; email?: string };
  order?: { orderNumber?: string; totalAmount?: number; paymentStatus?: string; orderStatus?: string };
};

const STATUS_OPTIONS = ["requested", "under_review", "approved", "rejected", "refund_pending", "refunded", "completed"];
const TYPE_FILTER_OPTIONS = toSelectOptions([
  ["", "All types"],
  ["return", "Returns"],
  ["cancellation", "Cancellations"],
]);
const STATUS_FILTER_OPTIONS = toSelectOptions([["", "All statuses"], ...STATUS_OPTIONS.map((value) => [value, humanizeStatus(value)] as const)]);

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
  const rows = listRequest.data ?? [];
  const summaryItems = Object.entries(summaryRequest.data ?? {})
    .slice(0, 6)
    .map(([key, value]) => ({ label: humanizeStatus(key), value: formatNumber(value) }));

  return (
    <>
      <AdminPageHeading
        eyebrow="Operations"
        title="Returns & cancellations"
        description="Review customer service requests and issue refunds."
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

      <AdminSummaryGrid label="Request summary" items={summaryItems} />

      <div className="admin-toolbar">
        <Select label="Request type" hideLabel options={TYPE_FILTER_OPTIONS} value={type} onChange={setType} />
        <Select label="Request status" hideLabel options={STATUS_FILTER_OPTIONS} value={status} onChange={setStatus} />
      </div>

      {listRequest.error ? (
        <ErrorCard
          title="Unable to load requests"
          description={listRequest.error}
          action={<LoadingButton type="button" onClick={() => void listRequest.refetch()}>Try again</LoadingButton>}
        />
      ) : listRequest.loading && rows.length === 0 ? (
        <TableSkeleton rows={8} />
      ) : rows.length === 0 ? (
        <div className="admin-empty-results" role="status">
          No service requests match these filters. Customers can request returns or cancellations from their order page.
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Requested</th>
                <th scope="col">Order</th>
                <th scope="col">Customer</th>
                <th scope="col">Type</th>
                <th scope="col">Reason</th>
                <th scope="col" className="is-numeric">Order value</th>
                <th scope="col">Status</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id}>
                  <td>{formatDateTime(row.createdAt)}</td>
                  <td><strong>{row.order?.orderNumber ?? "—"}</strong></td>
                  <td>
                    <span className="admin-cell-stack">
                      <strong>{row.customer?.name ?? "—"}</strong>
                      {row.customer?.email ? <small>{row.customer.email}</small> : null}
                    </span>
                  </td>
                  <td>{humanizeStatus(row.type)}</td>
                  <td><span className="admin-truncate" title={row.reason}>{row.reason || "—"}</span></td>
                  <td className="is-numeric">{row.order?.totalAmount !== undefined ? formatRupees(row.order.totalAmount) : "—"}</td>
                  <td><AdminStatusChip status={row.status} /></td>
                  <td className="is-action">
                    <Link className="admin-text-link" href={`/admin/returns/${row._id}`}>Review</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
