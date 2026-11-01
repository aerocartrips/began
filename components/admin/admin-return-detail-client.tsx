"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import AdminCard, { AdminDetailList } from "@/components/admin/admin-card";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import AdminStatusChip from "@/components/admin/admin-status-chip";
import ErrorCard from "@/components/ui/feedback/error-card";
import LoadingButton from "@/components/ui/buttons/loading-button";
import { OrderDetailSkeleton } from "@/components/ui/loaders/order-list-skeleton";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { useApiRequest } from "@/hooks/use-api-request";
import { useAsyncAction } from "@/hooks/use-async-action";
import { apiRequest } from "@/lib/api/api-client";
import { formatDateTime, formatRupees, humanizeStatus } from "@/lib/format";

type ServiceRequestDetail = {
  _id: string;
  type: string;
  status: string;
  reason?: string;
  customerRemarks?: string;
  internalNotes?: string;
  refundStatus?: string;
  razorpayRefundId?: string;
  createdAt: string;
  order?: { _id?: string; orderNumber?: string; totalAmount?: number; paymentStatus?: string; orderStatus?: string };
  customer?: { name?: string; email?: string; phone?: string; companyName?: string };
  statusHistory?: { previousStatus?: string; newStatus?: string; changedByLabel?: string; remarks?: string; createdAt?: string }[];
};

type Decision = "approved" | "rejected" | "refund";

const OPEN_STATUSES = new Set(["requested", "under_review"]);

const backLink = (
  <Link className="admin-back-link" href="/admin/returns">
    <ArrowLeft size={14} aria-hidden="true" /> All requests
  </Link>
);

export default function AdminReturnDetailClient({ requestId }: { requestId: string }) {
  const feedback = useFeedback();
  const endpoint = useMemo(() => `/api/v1/admin/service-requests/${encodeURIComponent(requestId)}`, [requestId]);
  const { data: request, loading, error, refetch } = useApiRequest<ServiceRequestDetail>(endpoint);
  const [remarks, setRemarks] = useState("");
  const [pending, setPending] = useState<Decision | null>(null);

  const { run: decide } = useAsyncAction(async (decision: Decision) => {
    if (decision === "refund" && !window.confirm("Issue a refund for this order through Razorpay?")) return null;
    if (decision === "rejected" && !window.confirm("Reject this request? The customer will see the updated status.")) return null;

    setPending(decision);
    const note = remarks.trim();
    const body =
      decision === "refund"
        ? { initiateRefund: true, remarks: note || "Refund initiated from admin returns" }
        : { status: decision, remarks: note || (decision === "approved" ? "Approved by admin" : "Rejected by admin") };
    try {
      await apiRequest(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      feedback.success(
        decision === "refund" ? "Refund initiated" : "Request updated",
        decision === "refund" ? "Razorpay is processing the refund." : `Request ${decision}.`,
      );
      setRemarks("");
      await refetch();
    } catch (decisionError) {
      feedback.error("Update failed", decisionError instanceof Error ? decisionError.message : "Try again.");
    } finally {
      setPending(null);
    }
    return null;
  });

  if (loading && !request) return <OrderDetailSkeleton inline />;
  if (error || !request) {
    return <ErrorCard title="Request unavailable" description={error || "This service request could not be found."} action={backLink} />;
  }

  const isOpen = OPEN_STATUSES.has(request.status);
  const canRefund = (request.refundStatus ?? "none") === "none" && request.order?.paymentStatus === "paid";
  const history = (request.statusHistory ?? []).slice().reverse();
  const busy = pending !== null;

  return (
    <>
      <AdminPageHeading
        eyebrow={`${humanizeStatus(request.type)} request`}
        title={request.order?.orderNumber ?? "Service request"}
        description={`Requested ${formatDateTime(request.createdAt)}`}
        action={backLink}
      />

      <div className="admin-detail-layout">
        <div className="admin-detail-main">
          <AdminCard title="Customer request">
            <AdminDetailList
              items={[
                { label: "Status", value: <AdminStatusChip status={request.status} /> },
                { label: "Type", value: humanizeStatus(request.type) },
                { label: "Reason", value: request.reason },
                { label: "Customer remarks", value: request.customerRemarks },
              ]}
            />
          </AdminCard>

          <AdminCard
            title="Decision"
            description={isOpen ? "Approve or reject this request. Your note is saved to the request history." : "This request has already been decided."}
          >
            <label className="admin-field">
              Note
              <textarea
                value={remarks}
                onChange={(event) => setRemarks(event.currentTarget.value)}
                rows={3}
                maxLength={2000}
                placeholder="Optional note stored with the decision"
              />
            </label>
            <div className="admin-form-actions">
              {canRefund ? (
                <LoadingButton type="button" variant="secondary" loading={pending === "refund"} disabled={busy} onClick={() => void decide("refund")}>
                  Initiate refund
                </LoadingButton>
              ) : null}
              <LoadingButton type="button" variant="destructive" loading={pending === "rejected"} disabled={busy || !isOpen} onClick={() => void decide("rejected")}>
                Reject
              </LoadingButton>
              <LoadingButton type="button" loading={pending === "approved"} disabled={busy || !isOpen} onClick={() => void decide("approved")}>
                Approve
              </LoadingButton>
            </div>
          </AdminCard>

          <AdminCard title="History" description="Most recent first.">
            {history.length === 0 ? (
              <p className="admin-muted-text">No decisions recorded yet.</p>
            ) : (
              <ol className="admin-history">
                {history.map((entry, index) => (
                  <li key={`${entry.createdAt}-${index}`}>
                    <div>
                      <strong>{humanizeStatus(entry.newStatus)}</strong>
                      <time>{formatDateTime(entry.createdAt, "")}</time>
                    </div>
                    <p>
                      {entry.remarks || "No note"}
                      {entry.changedByLabel ? <span className="admin-muted-text"> · {entry.changedByLabel}</span> : null}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </AdminCard>
        </div>

        <aside className="admin-detail-aside">
          <AdminCard
            title="Order"
            action={request.order?._id ? <Link className="admin-text-link" href={`/admin/orders/${request.order._id}`}>View order</Link> : null}
          >
            <AdminDetailList
              items={[
                { label: "Order", value: request.order?.orderNumber },
                { label: "Value", value: request.order?.totalAmount !== undefined ? formatRupees(request.order.totalAmount) : null },
                { label: "Payment", value: request.order?.paymentStatus ? <AdminStatusChip status={request.order.paymentStatus} /> : null },
                { label: "Fulfilment", value: request.order?.orderStatus ? <AdminStatusChip status={request.order.orderStatus} /> : null },
                { label: "Refund", value: <AdminStatusChip status={request.refundStatus ?? "none"} /> },
                { label: "Refund ID", value: request.razorpayRefundId ? <code>{request.razorpayRefundId}</code> : null },
              ]}
            />
          </AdminCard>
          <AdminCard title="Customer">
            <AdminDetailList
              items={[
                { label: "Name", value: request.customer?.name },
                { label: "Email", value: request.customer?.email },
                { label: "Phone", value: request.customer?.phone },
                { label: "Company", value: request.customer?.companyName },
              ]}
            />
          </AdminCard>
        </aside>
      </div>
    </>
  );
}
