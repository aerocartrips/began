"use client";

import Link from "next/link";
import { useMemo } from "react";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import ErrorCard from "@/components/ui/feedback/ErrorCard";
import LoadingButton from "@/components/ui/buttons/LoadingButton";
import { useApiRequest } from "@/hooks/useApiRequest";

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

export default function AdminCustomerDetailClient({ customerId }: { customerId: string }) {
  const endpoint = useMemo(
    () => `/api/v1/customers/${encodeURIComponent(customerId)}?detail=1`,
    [customerId],
  );
  const request = useApiRequest<CustomerDetailResponse>(endpoint);
  const data = request.data;

  if (request.loading && !data) {
    return <p className="admin-auth-loading" role="status">Loading customer…</p>;
  }

  if (request.error || !data) {
    return (
      <ErrorCard
        title="Customer unavailable"
        description={request.error || "Record not found."}
        action={<Link className="admin-text-link" href="/admin/customers">Back to customers</Link>}
      />
    );
  }

  const { customer, overview } = data;

  return (
    <div className="admin-page">
      <AdminPageHeading
        eyebrow="Customer"
        title={customer.name}
        description={customer.email}
        action={<Link className="admin-text-link" href="/admin/customers">Back to customers</Link>}
      />

      <div className="orders-summary-grid admin-orders-summary">
        <article><strong>{overview.totalOrders}</strong><span>Orders</span></article>
        <article><strong>{overview.totalQuantity}</strong><span>Units purchased</span></article>
        <article><strong>₹{overview.totalRevenue.toFixed(2)}</strong><span>Total value</span></article>
        <article><strong>₹{overview.averageOrderValue.toFixed(2)}</strong><span>Avg order</span></article>
      </div>

      <section className="admin-order-status-form">
        <h2>Profile</h2>
        <p>Phone: {customer.phone || "—"}</p>
        <p>Company: {customer.companyName || "—"}</p>
        <p>GSTIN: {customer.gstNumber || "—"}</p>
        <p>Registered: {new Date(customer.createdAt).toLocaleString()}</p>
        <p>Status: {customer.isActive ? "Active" : "Suspended"}</p>
      </section>

      <section>
        <h2>Recent orders</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Items</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Fulfillment</th>
              </tr>
            </thead>
            <tbody>
              {overview.orders.map((order) => (
                <tr key={order._id}>
                  <td><Link className="admin-text-link" href={`/admin/orders/${order._id}`}>{order.orderNumber}</Link></td>
                  <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                  <td>₹{order.totalAmount.toFixed(2)}</td>
                  <td>{order.paymentStatus}</td>
                  <td>{order.orderStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
