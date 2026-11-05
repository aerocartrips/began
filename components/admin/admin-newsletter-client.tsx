"use client";

import { useDeferredValue, useState } from "react";
import { Download } from "lucide-react";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import AdminCard from "@/components/admin/admin-card";
import AdminStatusChip from "@/components/admin/admin-status-chip";
import LoadingButton from "@/components/ui/buttons/loading-button";
import ErrorCard from "@/components/ui/feedback/error-card";
import Select, { type SelectOption } from "@/components/ui/form/select";
import TableSkeleton from "@/components/ui/loaders/table-skeleton";
import { useApiRequest } from "@/hooks/use-api-request";
import { formatDateTime, formatNumber } from "@/lib/format";

type Subscriber = {
  _id: string;
  email: string;
  status: "pending" | "subscribed" | "unsubscribed";
  source: string;
  createdAt: string;
  confirmedAt: string | null;
  unsubscribedAt: string | null;
};

const STATUS_TONE = { subscribed: "active", pending: "pending", unsubscribed: "inactive" } as const;
const STATUS_LABEL = { subscribed: "Subscribed", pending: "Awaiting confirmation", unsubscribed: "Unsubscribed" } as const;
const STATUS_OPTIONS: SelectOption[] = [
  { id: "", label: "All" },
  ...Object.entries(STATUS_LABEL).map(([id, label]) => ({ id, label })),
];
const PAGE_SIZE = 25;

export default function AdminNewsletterClient() {
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const deferredQuery = useDeferredValue(query.trim());
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), ...(status ? { status } : {}), ...(deferredQuery ? { q: deferredQuery } : {}) });
  const { loading, error, data, meta, refetch } = useApiRequest<Subscriber[]>(`/api/v1/admin/newsletter?${params}`);
  const counts = (meta?.counts ?? {}) as Partial<Record<Subscriber["status"], number>>;
  const totalPages = Number(meta?.totalPages ?? 1);

  return (
    <>
      <AdminPageHeading
        eyebrow="Marketing"
        title="Newsletter"
        description="People who signed up on the home page. Addresses are only exported once the subscriber has confirmed."
        action={
          <a className="button button-glass button-sm" href="/api/v1/admin/newsletter?format=csv" download>
            <Download size={14} aria-hidden="true" /> Export confirmed (CSV)
          </a>
        }
      />
      <div className="admin-newsletter-stats" role="group" aria-label="Subscriber counts">
        {(["subscribed", "pending", "unsubscribed"] as const).map((key) => (
          <div key={key}>
            <strong>{formatNumber(counts[key] ?? 0)}</strong>
            <span>{STATUS_LABEL[key]}</span>
          </div>
        ))}
      </div>
      <AdminCard
        action={
          <div className="admin-heading-actions">
            <input type="search" aria-label="Search by email" placeholder="Search by email" value={query} onChange={(event) => { setQuery(event.currentTarget.value); setPage(1); }} />
            <Select
              label="Filter by status"
              hideLabel
              options={STATUS_OPTIONS}
              value={status}
              onChange={(next) => {
                setStatus(next);
                setPage(1);
              }}
            />
          </div>
        }
      >
        {error ? (
          <ErrorCard title="Unable to load subscribers" description={error} action={<LoadingButton onClick={() => void refetch()}>Retry</LoadingButton>} />
        ) : loading && !data ? (
          <TableSkeleton rows={6} />
        ) : !data?.length ? (
          <div className="admin-empty-results" role="status">No subscribers match.</div>
        ) : (
          <div className="admin-table-wrap is-flush">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col">Status</th>
                  <th scope="col">Signed up</th>
                  <th scope="col">Confirmed</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row._id}>
                    <td>{row.email}</td>
                    <td><AdminStatusChip status={STATUS_TONE[row.status]} label={STATUS_LABEL[row.status]} /></td>
                    <td>{formatDateTime(row.createdAt)}</td>
                    <td>{row.confirmedAt ? formatDateTime(row.confirmedAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 ? (
          <div className="catalog-pagination">
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span aria-current="page">{page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        ) : null}
      </AdminCard>
    </>
  );
}
