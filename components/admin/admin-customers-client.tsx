"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import AdminStatusChip from "@/components/admin/admin-status-chip";
import AdminSummaryGrid from "@/components/admin/admin-summary-grid";
import ErrorCard from "@/components/ui/feedback/error-card";
import LoadingButton from "@/components/ui/buttons/loading-button";
import Select, { type SelectOption } from "@/components/ui/form/select";
import TableSkeleton from "@/components/ui/loaders/table-skeleton";
import { useApiRequest } from "@/hooks/use-api-request";
import { formatDate, formatNumber, formatRupees } from "@/lib/format";

const ORDER_HISTORY_OPTIONS: SelectOption[] = [
  { id: "", label: "All customers" },
  { id: "true", label: "With orders" },
  { id: "false", label: "Without orders" },
];

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

  function applySearch(event: FormEvent) {
    event.preventDefault();
    if (search === appliedSearch) void listRequest.refetch();
    else setAppliedSearch(search);
  }

  return (
    <>
      <AdminPageHeading eyebrow="People" title="Customers" description="Wholesale accounts, order history, and revenue." />

      {summary ? (
        <AdminSummaryGrid
          label="Customer summary"
          items={[
            { label: "Total customers", value: formatNumber(summary.totalCustomers) },
            { label: "Active", value: formatNumber(summary.activeCustomers) },
            { label: "New (30 days)", value: formatNumber(summary.newCustomers30d) },
            { label: "With orders", value: formatNumber(summary.customersWithOrders) },
            { label: "Total orders", value: formatNumber(summary.totalOrders) },
            { label: "Revenue", value: formatRupees(summary.totalRevenue, { compact: true }) },
          ]}
        />
      ) : null}

      <form className="admin-toolbar" onSubmit={applySearch} role="search">
        <label className="admin-toolbar__search">
          <span className="sr-only">Search customers</span>
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder="Search name, email, phone, company…"
          />
        </label>
        <Select label="Order history" hideLabel options={ORDER_HISTORY_OPTIONS} value={hasOrders} onChange={setHasOrders} />
        <LoadingButton type="submit" variant="secondary" loading={listRequest.loading}>
          Apply
        </LoadingButton>
      </form>

      {listRequest.error ? (
        <ErrorCard
          title="Unable to load customers"
          description={listRequest.error}
          action={<LoadingButton type="button" onClick={() => void listRequest.refetch()}>Try again</LoadingButton>}
        />
      ) : listRequest.loading && customers.length === 0 ? (
        <TableSkeleton rows={8} />
      ) : customers.length === 0 ? (
        <div className="admin-empty-results" role="status">
          No customers match these filters. Customers appear after registration or checkout.
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Company</th>
                <th scope="col" className="is-numeric">Orders</th>
                <th scope="col" className="is-numeric">Revenue</th>
                <th scope="col">Last order</th>
                <th scope="col">Joined</th>
                <th scope="col">Status</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer._id}>
                  <td>
                    <span className="admin-person-cell">
                      <span className="admin-avatar" aria-hidden="true">{customer.name.charAt(0).toUpperCase()}</span>
                      <span className="admin-cell-stack">
                        <strong>{customer.name}</strong>
                        <small>{customer.email}</small>
                      </span>
                    </span>
                  </td>
                  <td>{customer.companyName || <span className="admin-muted-text">—</span>}</td>
                  <td className="is-numeric">{formatNumber(customer.totalOrders ?? 0)}</td>
                  <td className="is-numeric"><strong>{formatRupees(customer.totalRevenue ?? 0)}</strong></td>
                  <td>{formatDate(customer.lastOrderAt)}</td>
                  <td>{formatDate(customer.createdAt)}</td>
                  <td><AdminStatusChip status={customer.isActive ? "active" : "suspended"} /></td>
                  <td className="is-action">
                    <Link className="admin-text-link" href={`/admin/customers/${customer._id}`}>View</Link>
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
