"use client";

import Link from "next/link";
import { useState } from "react";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import IntegrationState from "@/components/admin/integration-state";
import type { ContactMessage } from "@/features/messages/types/contact-message";

type MessageInboxClientProps = {
  messages: ContactMessage[] | null;
  storageUnavailable: boolean;
};

export default function MessageInboxClient({ messages, storageUnavailable }: MessageInboxClientProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  if (storageUnavailable || !messages) {
    return (
      <>
        <AdminPageHeading eyebrow="Support" title="Messages" description="Review customer inquiries and contact requests." />
        <IntegrationState
          title="Message storage is unavailable"
          description="The local contact file could not be read or written. No message was discarded or marked as delivered."
          requirement="Writable local storage for development, or a configured production database."
        />
      </>
    );
  }

  const unreadCount = messages.filter((message) => message.status === "new").length;
  const visibleMessages = messages.filter((message) => {
    const searchable = `${message.name} ${message.email} ${message.subject}`.toLowerCase();
    return searchable.includes(query.trim().toLowerCase()) &&
      (status === "all" || message.status === status);
  });

  return (
    <>
      <AdminPageHeading
        eyebrow="Support inbox"
        title="Messages"
        description={`${unreadCount} unread · ${messages.length} saved in local message storage`}
      />
      <div className="admin-product-filters">
        <label><span className="sr-only">Search messages</span><input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search name, email or subject..." /></label>
        <label><span className="sr-only">Filter message status</span><select value={status} onChange={(event) => setStatus(event.currentTarget.value)}><option value="all">All messages</option><option value="new">Unread</option><option value="read">Read</option><option value="archived">Archived</option></select></label>
      </div>
      {visibleMessages.length === 0 ? (
        <div className="admin-empty-results" role="status">{messages.length === 0 ? "No contact messages have been received." : "No messages match these filters."}</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th scope="col">Received</th><th scope="col">Customer</th><th scope="col">Subject</th><th scope="col">Status</th><th scope="col">Message</th></tr></thead>
            <tbody>
              {visibleMessages.map((message) => (
                <tr key={message.id}>
                  <td>{new Date(message.createdAt).toLocaleString()}</td>
                  <td><strong>{message.name}</strong><br /><small>{message.email}</small></td>
                  <td>{message.subject}</td>
                  <td><span className={`admin-status-chip ${message.status === "new" ? "is-new" : message.status === "archived" ? "is-draft" : ""}`}>{message.status}</span></td>
                  <td><Link href={`/admin/messages/${message.id}`}>Open message</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="admin-storage-note">Local file storage is for single-instance testing. Use a database before deploying multiple instances.</p>
    </>
  );
}