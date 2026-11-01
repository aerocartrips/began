"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import AdminCard, { AdminDetailList } from "@/components/admin/admin-card";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import AdminStatusChip from "@/components/admin/admin-status-chip";
import AdminSummaryGrid from "@/components/admin/admin-summary-grid";
import ErrorCard from "@/components/ui/feedback/error-card";
import { OrderDetailSkeleton } from "@/components/ui/loaders/order-list-skeleton";
import { useApiRequest } from "@/hooks/use-api-request";
import { formatDate, formatDateTime, formatNumber, formatRupees } from "@/lib/format";

type CustomerDetailResponse = {
  customer: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    companyName?: string;
    gstNumber?: string;
    isActive: boolean;
    createdAt: string;
  };
  overview: {
    totalOrders: number;
    totalRevenue: number;
    totalQuantity: number;
    averageOrderValue: number;
    orders: {
      _id: string;
      orderNumber: string;
      createdAt: string;
      totalAmount: number;
      paymentStatus: string;
      orderStatus: string;
      items: { quantity: number; productName: string }[];
    }[];
  };
};

const backLink = (
  <Link className="admin-back-link" href="/admin/customers">
    <ArrowLeft size={14} aria-hidden="true" /> All customers
  </Link>
);

export default function AdminCustomerDetailClient({ customerId }: { customerId: string }) {
  const endpoint = useMemo(() => `/api/v1/customers/${encodeURIComponent(customerId)}?detail=1`, [customerId]);
  const request = useApiRequest<CustomerDetailResponse>(endpoint);
  const data = request.data;

  if (request.loading && !data) return <OrderDetailSkeleton inline />;

  if (request.error || !data) {
    return <ErrorCard title="Customer unavailable" description={request.error || "Record not found."} action={backLink} />;
  }

  const { customer, overview } = data;

  return (
    <>
      <AdminPageHeading eyebrow="Customer" title={customer.name} description={customer.email} action={backLink} />

      <AdminSummaryGrid
        label="Customer totals"
        items={[
          { label: "Orders", value: formatNumber(overview.totalOrders) },
          { label: "Units purchased", value: formatNumber(overview.totalQuantity) },
          { label: "Total value", value: formatRupees(overview.totalRevenue) },
          { label: "Average order", value: formatRupees(overview.averageOrderValue) },
        ]}
      />

      <div className="admin-detail-layout">
        <div className="admin-detail-main">
          <AdminCard title="Recent orders">
            {overview.orders.length === 0 ? (
              <div className="admin-empty-results" role="status">This customer has not placed an order yet.</div>
            ) : (
              <div className="admin-table-wrap is-flush">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Order</th>
                      <th scope="col">Placed</th>
                      <th scope="col" className="is-numeric">Units</th>
                      <th scope="col" className="is-numeric">Amount</th>
                      <th scope="col">Payment</th>
                      <th scope="col">Fulfilment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.orders.map((order) => (
                      <tr key={order._id}>
                        <td><Link className="admin-text-link" href={`/admin/orders/${order._id}`}>{order.orderNumber}</Link></td>
                        <td>{formatDateTime(order.createdAt)}</td>
                        <td className="is-numeric">{formatNumber(order.items.reduce((sum, item) => sum + item.quantity, 0))}</td>
                        <td className="is-numeric"><strong>{formatRupees(order.totalAmount)}</strong></td>
                        <td><AdminStatusChip status={order.paymentStatus} /></td>
                        <td><AdminStatusChip status={order.orderStatus} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AdminCard>
        </div>

        <aside className="admin-detail-aside">
          <AdminCard title="Profile">
            <AdminDetailList
              items={[
                { label: "Status", value: <AdminStatusChip status={customer.isActive ? "active" : "suspended"} /> },
                { label: "Email", value: <a className="admin-text-link" href={`mailto:${customer.email}`}>{customer.email}</a> },
                { label: "Phone", value: customer.phone },
                { label: "Company", value: customer.companyName },
                { label: "GSTIN", value: customer.gstNumber ? <code>{customer.gstNumber}</code> : null },
                { label: "Registered", value: formatDate(customer.createdAt) },
              ]}
            />
          </AdminCard>
        </aside>
      </div>
    </>
  );
}
