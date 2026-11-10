"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import AdminStatusChip from "@/components/admin/admin-status-chip";
import AdminSummaryGrid from "@/components/admin/admin-summary-grid";
import CountBadge from "@/components/ui/count-badge";
import Select, { toSelectOptions } from "@/components/ui/form/select";
import { categoryLabel, SUPPORT_CATEGORY_OPTIONS } from "@/features/support/support-labels";
import { formatDateTime, formatNumber } from "@/lib/format";

export type SupportInboxRow = {
  id: string;
  conversationId: string;
  customerId: string | null;
  name: string;
  email: string;
  subject: string;
  category: string;
  source: string;
  status: string;
  priority: string;
  unread: boolean;
  unreadCount: number;
  awaitingReply: boolean;
  lastMessageFrom: "customer" | "support" | null;
  orderId: string | null;
  orderNumber: string | null;
  preview: string;
  createdAt: string;
  updatedAt: string;
};

type InboxFilters = { status: string; category: string; view: string; search: string; page: string };

type InboxProps = {
  conversations: SupportInboxRow[];
  meta: { page: number; totalPages: number; total: number };
  counts: { total: number; unread: number; awaiting: number; open: number };
  filters: InboxFilters;
};

const STATUS_OPTIONS = toSelectOptions([
  ["", "All statuses"],
  ["open", "Open"],
  ["in_progress", "In progress"],
  ["waiting_customer", "Waiting for customer"],
  ["resolved", "Resolved"],
  ["closed", "Closed"],
]);

const VIEW_OPTIONS = toSelectOptions([
  ["", "All conversations"],
  ["awaiting", "Awaiting reply"],
  ["unread", "Unread"],
]);

const TOPIC_OPTIONS = toSelectOptions([["", "All topics"], ...SUPPORT_CATEGORY_OPTIONS.map((option) => [option.value, option.label] as const)]);

/** Re-fetch the server-rendered inbox periodically so new customer messages show up. */
const INBOX_REFRESH_MS = 30_000;

export default function AdminSupportInboxClient({ conversations, meta, counts, filters }: InboxProps) {
  const router = useRouter();
  const [query, setQuery] = useState(filters.search);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, INBOX_REFRESH_MS);
    return () => clearInterval(timer);
  }, [router]);

  function hrefWith(changes: Partial<InboxFilters>) {
    const next = { ...filters, page: "1", ...changes };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
      if (value && !(key === "page" && value === "1")) params.set(key, value);
    }
    const qs = params.toString();
    return qs ? `/admin/messages?${qs}` : "/admin/messages";
  }

  function apply(changes: Partial<InboxFilters>) {
    router.push(hrefWith(changes));
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    apply({ search: query.trim() });
  }

  const page = meta.page || 1;
  const hasFilters = Boolean(filters.status || filters.category || filters.view || filters.search);

  return (
    <>
      <AdminPageHeading eyebrow="Support" title="Messages" description="Customer conversations from accounts, the contact form and order pages." />

      <AdminSummaryGrid
        label="Inbox summary"
        items={[
          { label: "Conversations", value: formatNumber(counts.total) },
          { label: "Awaiting reply", value: formatNumber(counts.awaiting) },
          { label: "Unread", value: formatNumber(counts.unread) },
          { label: "Active", value: formatNumber(counts.open) },
        ]}
      />

      <form className="admin-toolbar" role="search" onSubmit={submitSearch}>
        <label className="admin-toolbar__search">
          <span className="sr-only">Search conversations</span>
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            value={query}
            maxLength={100}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search name, email, subject… (Enter)"
          />
        </label>
        <Select label="View" hideLabel options={VIEW_OPTIONS} value={filters.view} onChange={(view) => apply({ view })} />
        <Select label="Status" hideLabel options={STATUS_OPTIONS} value={filters.status} onChange={(status) => apply({ status })} />
        <Select label="Topic" hideLabel options={TOPIC_OPTIONS} value={filters.category} onChange={(category) => apply({ category })} />
      </form>

      {conversations.length === 0 ? (
        <div className="admin-empty-results" role="status">
          {hasFilters ? "No conversations match these filters." : "No customer messages yet."}
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Conversation</th>
                <th scope="col">Topic</th>
                <th scope="col">Status</th>
                <th scope="col">Last activity</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {conversations.map((row) => (
                <tr key={row.conversationId} className={row.unread ? "is-unread" : undefined}>
                  <td>
                    <span className="admin-person-cell">
                      <span className="admin-avatar" aria-hidden="true">{(row.name || row.email || "?").charAt(0).toUpperCase()}</span>
                      <span className="admin-cell-stack">
                        <strong>
                          {row.name || "Guest"}
                          {row.unread ? <CountBadge count={row.unreadCount} label="unread" /> : null}
                        </strong>
                        <small>{row.email}{row.customerId ? "" : " · guest"}</small>
                      </span>
                    </span>
                  </td>
                  <td>
                    <span className="admin-cell-stack is-wrapping">
                      <strong>{row.subject}</strong>
                      {row.preview ? <small>{row.lastMessageFrom === "support" ? "You: " : ""}{row.preview}</small> : null}
                    </span>
                  </td>
                  <td>
                    <span className="admin-cell-stack">
                      <span>{categoryLabel(row.category)}</span>
                      {row.orderNumber ? <small>{row.orderNumber}</small> : null}
                    </span>
                  </td>
                  <td>
                    <span className="admin-cell-stack">
                      <AdminStatusChip status={row.status} />
                      {row.awaitingReply ? <span className="admin-awaiting">Awaiting reply</span> : null}
                    </span>
                  </td>
                  <td>{formatDateTime(row.updatedAt || row.createdAt)}</td>
                  <td className="is-action">
                    <Link className="admin-text-link" href={`/admin/messages/${row.id}`}>Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta.totalPages > 1 ? (
        <nav className="admin-support-pagination" aria-label="Inbox pages">
          {page > 1 ? <Link className="admin-text-link" href={hrefWith({ page: String(page - 1) })}>← Newer</Link> : <span />}
          <small>Page {page} of {meta.totalPages}</small>
          {page < meta.totalPages ? <Link className="admin-text-link" href={hrefWith({ page: String(page + 1) })}>Older →</Link> : <span />}
        </nav>
      ) : null}
    </>
  );
}
