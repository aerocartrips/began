"use client";

import EmptyState from "@/components/ui/empty-state";
import ErrorCard from "@/components/ui/feedback/ErrorCard";
import TableSkeleton from "@/components/ui/loaders/TableSkeleton";
import LoadingButton from "@/components/ui/buttons/LoadingButton";
import PaymentRefundPanel from "@/components/admin/payment-refund-panel";
import { useApiRequest } from "@/hooks/useApiRequest";
import AdminPageHeading from "@/components/admin/admin-page-heading";

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
      {loading ? <TableSkeleton rows={8} /> : null}
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
        <EmptyState
          title="No payment records yet"
          description="Captured and failed Razorpay payments will appear here after customers checkout."
        />
      ) : null}
      {!loading && payments.length > 0 ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Method</th>
                <th>Razorpay IDs</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment._id}>
                  <td>{payment.order?.orderNumber ?? "—"}</td>
                  <td>{payment.user?.email ?? payment.user?.name ?? "—"}</td>
                  <td>{(payment.amount / 100).toFixed(2)} {payment.currency}</td>
                  <td>{payment.status}</td>
                  <td>{payment.method || "—"}</td>
                  <td>
                    <small>{payment.razorpayPaymentId || payment.razorpayOrderId || "—"}</small>
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
