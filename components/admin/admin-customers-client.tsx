"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import EmptyState from "@/components/ui/empty-state";
import ErrorCard from "@/components/ui/feedback/ErrorCard";
import LoadingButton from "@/components/ui/buttons/LoadingButton";
import TableSkeleton from "@/components/ui/loaders/TableSkeleton";
import { useApiRequest } from "@/hooks/useApiRequest";

type CustomerRow = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  companyName?: string;
  createdAt: string;
  isActive: boolean;
  totalOrders?: number;
  totalRevenue?: number;
  lastOrderAt?: string | null;
};

type CustomerSummary = {
  totalCustomers: number;
  activeCustomers: number;
  newCustomers30d: number;
  customersWithOrders: number;
  totalOrders: number;
  totalRevenue: number;
};

export default function AdminCustomersClient() {
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [hasOrders, setHasOrders] = useState("");

  const listEndpoint = useMemo(() => {
    const params = new URLSearchParams({ limit: "30" });
    if (appliedSearch.trim()) params.set("search", appliedSearch.trim());
    if (hasOrders) params.set("hasOrders", hasOrders);
    return `/api/v1/customers?${params.toString()}`;
  }, [appliedSearch, hasOrders]);

  const summaryRequest = useApiRequest<CustomerSummary>("/api/v1/customers/summary");
  const listRequest = useApiRequest<CustomerRow[]>(listEndpoint);
  const customers = listRequest.data ?? [];
  const summary = summaryRequest.data;

  return (
    <div className="admin-page">
      <AdminPageHeading eyebrow="People" title="Customers" description="Wholesale accounts, order history, and revenue." />

      {summary ? (
        <div className="orders-summary-grid admin-orders-summary">
          <article><strong>{summary.totalCustomers}</strong><span>Total customers</span></article>
          <article><strong>{summary.activeCustomers}</strong><span>Active</span></article>
          <article><strong>{summary.newCustomers30d}</strong><span>New (30d)</span></article>
          <article><strong>{summary.customersWithOrders}</strong><span>With orders</span></article>
          <article><strong>{summary.totalOrders}</strong><span>Total orders</span></article>
          <article><strong>₹{summary.totalRevenue.toFixed(0)}</strong><span>Revenue</span></article>
        </div>
      ) : null}

      <div className="orders-toolbar">
        <label>
          Search
          <input value={search} onChange={(event) => setSearch(event.currentTarget.value)} placeholder="Name, email, phone, company" />
        </label>
        <label>
          Orders
          <select value={hasOrders} onChange={(event) => setHasOrders(event.currentTarget.value)}>
            <option value="">All</option>
            <option value="true">With orders</option>
            <option value="false">Without orders</option>
          </select>
        </label>
        <LoadingButton type="button" variant="secondary" loading={listRequest.loading} onClick={() => setAppliedSearch(search)}>
          Apply
        </LoadingButton>
      </div>

      {listRequest.loading && customers.length === 0 ? <TableSkeleton rows={8} /> : null}
      {listRequest.error ? (
        <ErrorCard title="Unable to load customers" description={listRequest.error} action={<LoadingButton type="button" onClick={() => void listRequest.refetch()}>Try again</LoadingButton>} />
      ) : null}
      {!listRequest.loading && customers.length === 0 ? (
        <EmptyState title="No customers found" description="Customers appear after registration or checkout." />
      ) : null}

      {!listRequest.loading && customers.length > 0 ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Company</th>
                <th>Orders</th>
                <th>Revenue</th>
                <th>Last order</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer._id}>
                  <td>
                    <strong>{customer.name}</strong>
                    <small>{customer.email}</small>
                  </td>
                  <td>{customer.companyName || "—"}</td>
                  <td>{customer.totalOrders ?? 0}</td>
                  <td>₹{(customer.totalRevenue ?? 0).toFixed(2)}</td>
                  <td>{customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleDateString() : "—"}</td>
                  <td>{customer.isActive ? "Active" : "Suspended"}</td>
                  <td><Link className="admin-text-link" href={`/admin/customers/${customer._id}`}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
