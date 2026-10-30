"use client";

import Link from "next/link";
import { useMemo } from "react";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import LoadingButton from "@/components/ui/buttons/LoadingButton";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import { useApiRequest } from "@/hooks/useApiRequest";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { apiRequest } from "@/lib/api/api-client";

export default function AdminReturnDetailClient({ requestId }: { requestId: string }) {
  const feedback = useFeedback();
  const endpoint = useMemo(() => `/api/v1/admin/service-requests/${requestId}`, [requestId]);
  const { data, loading, error, refetch } = useApiRequest<Record<string, unknown>>(endpoint);

  const { run: approve, loading: saving } = useAsyncAction(async () => {
    await apiRequest(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved", remarks: "Approved by admin" }),
    });
    feedback.success("Updated", "Request approved.");
    await refetch();
    return null;
  });

  const { run: reject, loading: rejecting } = useAsyncAction(async () => {
    await apiRequest(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected", remarks: "Rejected by admin" }),
    });
    feedback.success("Updated", "Request rejected.");
    await refetch();
    return null;
  });

  const { run: refund, loading: refunding } = useAsyncAction(async () => {
    await apiRequest(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initiateRefund: true, remarks: "Refund initiated from admin returns" }),
    });
    feedback.success("Refund", "Refund initiated when eligible.");
    await refetch();
    return null;
  });

  if (loading && !data) return <p>Loading…</p>;
  if (error || !data) return <p>{error || "Not found"}</p>;

  const request = data as {
    type?: string;
    status?: string;
    reason?: string;
    customerRemarks?: string;
    order?: { orderNumber?: string; totalAmount?: number };
    customer?: { name?: string; email?: string };
  };

  return (
    <div className="admin-page">
      <AdminPageHeading
        eyebrow="Service request"
        title={request.order?.orderNumber ?? "Request"}
        description={`${request.type ?? ""} · ${request.status ?? ""}`}
        action={<Link className="admin-text-link" href="/admin/returns">Back</Link>}
      />
      <p>{request.customer?.name} · {request.customer?.email}</p>
      <p><strong>Reason:</strong> {request.reason}</p>
      <p>{request.customerRemarks}</p>
      <div className="orders-detail-actions">
        <LoadingButton loading={saving} onClick={() => void approve()}>Approve</LoadingButton>
        <LoadingButton variant="secondary" loading={rejecting} onClick={() => void reject()}>Reject</LoadingButton>
        <LoadingButton variant="secondary" loading={refunding} onClick={() => void refund()}>Initiate refund</LoadingButton>
      </div>
    </div>
  );
}
