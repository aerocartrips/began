"use client";

import { useState } from "react";
import Link from "next/link";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import LoadingButton from "@/components/ui/buttons/LoadingButton";
import ClientFormattedTime from "@/components/ui/ClientFormattedTime";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { apiRequest } from "@/lib/api/api-client";

type SupportDetailProps = {
  conversationId: string;
  subject: string;
  customerLabel: string;
  status: string;
  messages: { _id: string; body: string; senderRole: string; createdAt: string }[];
};

export default function AdminSupportDetailClient({
  conversationId,
  subject,
  customerLabel,
  status: initialStatus,
  messages,
}: SupportDetailProps) {
  const feedback = useFeedback();
  const [status, setStatus] = useState(initialStatus);
  const [reply, setReply] = useState("");

  const { run: sendReply, loading } = useAsyncAction(async () => {
    await apiRequest("/api/v1/admin/support/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, body: reply }),
    });
    feedback.success("Reply sent", "Your message was saved.");
    setReply("");
    window.location.reload();
    return null;
  });

  const { run: updateStatus, loading: updating } = useAsyncAction(async (next: string) => {
    await apiRequest("/api/v1/admin/support/conversations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, status: next }),
    });
    setStatus(next);
    feedback.success("Status updated", next);
    return null;
  });

  return (
    <>
      <AdminPageHeading
        eyebrow="Support inbox"
        title={subject}
        description={customerLabel}
        action={<Link className="admin-text-link" href="/admin/messages">Back to inbox</Link>}
      />
      <div className="admin-message-meta">
        <span className="admin-status-chip">{status}</span>
        <LoadingButton type="button" variant="secondary" loading={updating} onClick={() => void updateStatus("resolved")}>
          Mark resolved
        </LoadingButton>
      </div>
      <div className="admin-message-thread">
        {messages.map((message) => (
          <article key={message._id} className={`admin-message-detail ${message.senderRole}`}>
            <header>
              <strong>{message.senderRole}</strong>
              <ClientFormattedTime value={message.createdAt} />
            </header>
            <p>{message.body}</p>
          </article>
        ))}
      </div>
      <label>
        Reply
        <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={4} />
      </label>
      <LoadingButton type="button" loading={loading} disabled={!reply.trim()} onClick={() => void sendReply()}>
        Send reply
      </LoadingButton>
    </>
  );
}
