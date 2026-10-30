"use client";

import Link from "next/link";
import { useState } from "react";
import AdminPageHeading from "@/components/admin/admin-page-heading";

export type SupportInboxRow = {
  id: string;
  conversationId: string;
  name: string;
  email: string;
  subject: string;
  status: string;
  priority: string;
  unread: boolean;
  preview: string;
  createdAt: string;
  updatedAt: string;
};

type AdminSupportInboxClientProps = {
  conversations: SupportInboxRow[];
};

export default function AdminSupportInboxClient({ conversations }: AdminSupportInboxClientProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const unreadCount = conversations.filter((row) => row.unread).length;
  const visible = conversations.filter((row) => {
    const searchable = `${row.name} ${row.email} ${row.subject}`.toLowerCase();
    return (
      searchable.includes(query.trim().toLowerCase()) &&
      (status === "all" || row.status === status)
    );
  });

  return (
    <>
      <AdminPageHeading
        eyebrow="Support inbox"
        title="Messages"
        description={`${unreadCount} unread · ${conversations.length} conversations`}
      />
      <div className="admin-product-filters">
        <label>
          <span className="sr-only">Search</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, subject..." />
        </label>
        <label>
          <span className="sr-only">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="waiting_customer">Waiting for customer</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </label>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Updated</th>
              <th>Customer</th>
              <th>Subject</th>
              <th>Status</th>
              <th>Preview</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.conversationId}>
                <td>{new Date(row.updatedAt || row.createdAt).toLocaleString()}</td>
                <td>
                  <strong>{row.name}</strong>
                  {row.unread ? <span className="admin-status-chip is-new"> unread</span> : null}
                  <br />
                  <small>{row.email}</small>
                </td>
                <td>{row.subject}</td>
                <td><span className="admin-status-chip">{row.status}</span></td>
                <td><Link href={`/admin/messages/${row.id}`}>Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
