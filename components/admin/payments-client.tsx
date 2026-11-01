"use client";

import ErrorCard from "@/components/ui/feedback/error-card";
import TableSkeleton from "@/components/ui/loaders/table-skeleton";
import LoadingButton from "@/components/ui/buttons/loading-button";
import PaymentRefundPanel from "@/components/admin/payment-refund-panel";
import { useApiRequest } from "@/hooks/use-api-request";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import AdminStatusChip from "@/components/admin/admin-status-chip";
import { humanizeStatus } from "@/lib/format";

const amountFormatter = (currency: string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: currency || "INR", minimumFractionDigits: 2 });

type PaymentRow = {
  _id: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  amount: number;
  currency: string;
  status: string;
  method?: string;
  refundedAmount?: number;
  order?: { _id?: string; orderNumber?: string; paymentStatus?: string; orderStatus?: string };
  user?: { name?: string; email?: string };
};

export default function AdminPaymentsClient() {
  const { loading, error, data, refetch } = useApiRequest<PaymentRow[]>("/api/v1/payments?limit=20");
  const payments = data ?? [];

  return (
    <>
      <AdminPageHeading
        eyebrow="Finance"
        title="Payments"
        description="Verified Razorpay transactions, failures, and refund states."
        action={
          <LoadingButton type="button" variant="secondary" loading={loading} onClick={() => void refetch()}>
            Refresh
          </LoadingButton>
        }
      />
      {loading && payments.length === 0 ? <TableSkeleton rows={8} /> : null}
      {error ? (
        <ErrorCard
          title="Unable to load payments"
          description={error}
          action={
            <LoadingButton type="button" onClick={() => void refetch()}>
              Try again
            </LoadingButton>
          }
        />
      ) : null}
      {!loading && !error && payments.length === 0 ? (
        <div className="admin-empty-results" role="status">
          No payment records yet. Captured and failed Razorpay payments appear here after customers check out.
        </div>
      ) : null}
      {payments.length > 0 ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Customer</th>
                <th scope="col" className="is-numeric">Amount</th>
                <th scope="col">Status</th>
                <th scope="col">Method</th>
                <th scope="col">Razorpay ID</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment._id}>
                  <td><strong>{payment.order?.orderNumber ?? "—"}</strong></td>
                  <td>
                    <span className="admin-cell-stack">
                      <strong>{payment.user?.name ?? "—"}</strong>
                      {payment.user?.email ? <small>{payment.user.email}</small> : null}
                    </span>
                  </td>
                  <td className="is-numeric">
                    <strong>{amountFormatter(payment.currency).format(payment.amount / 100)}</strong>
                    {payment.refundedAmount ? (
                      <small className="admin-cell-note">
                        Refunded {amountFormatter(payment.currency).format(payment.refundedAmount / 100)}
                      </small>
                    ) : null}
                  </td>
                  <td><AdminStatusChip status={payment.status} /></td>
                  <td>{humanizeStatus(payment.method)}</td>
                  <td>
                    <code>{payment.razorpayPaymentId || payment.razorpayOrderId || "—"}</code>
                  </td>
                  <td>
                    <PaymentRefundPanel payment={payment} onCompleted={() => void refetch()} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
