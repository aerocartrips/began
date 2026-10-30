"use client";

import Link from "next/link";
import { useState } from "react";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import LoadingButton from "@/components/ui/buttons/LoadingButton";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import type { ContactMessage } from "@/features/messages/types/contact-message";
import { updateContactMessageStatus } from "@/features/messages/actions";

type MessageDetailClientProps = {
  message: ContactMessage;
};

export default function MessageDetailClient({ message }: MessageDetailClientProps) {
  const feedback = useFeedback();
  const [status, setStatus] = useState(message.status);

  const { run: changeStatus, loading: pending } = useAsyncAction(
    async (nextStatus: ContactMessage["status"]) => {
      if (status === nextStatus) return null;
      const result = await updateContactMessageStatus(message.id, nextStatus);
      if (result.ok) {
        setStatus(nextStatus);
        feedback.success("Message updated", `Marked as ${nextStatus}.`, `message-${message.id}-${nextStatus}`);
        return null;
      }
      feedback.error("Update failed", "We could not update this message. Try again.");
      return null;
    },
  );

  return (
    <>
      <AdminPageHeading
        eyebrow="Support inbox"
        title={message.subject}
        description={`${message.name} · ${message.email} · ${new Date(message.createdAt).toLocaleString()}`}
        action={<Link className="admin-text-link" href="/admin/messages">Back to inbox</Link>}
      />
      <article className="admin-message-detail">
        <div className="admin-message-meta">
          <span className={`admin-status-chip ${status === "new" ? "is-new" : ""}`}>{status}</span>
          {message.phone && <a href={`tel:${message.phone.replace(/[^+\d]/g, "")}`}>{message.phone}</a>}
        </div>
        <p className="admin-message-body">{message.message}</p>
        <div className="admin-message-actions">
          <LoadingButton
            type="button"
            variant="secondary"
            loading={pending}
            loadingText="Updating..."
            disabled={status === "read"}
            onClick={() => void changeStatus("read")}
          >
            Mark read
          </LoadingButton>
          <LoadingButton
            type="button"
            variant="secondary"
            loading={pending}
            loadingText="Updating..."
            disabled={status === "new"}
            onClick={() => void changeStatus("new")}
          >
            Mark unread
          </LoadingButton>
          <LoadingButton
            type="button"
            variant="secondary"
            loading={pending}
            loadingText="Updating..."
            disabled={status === "archived"}
            onClick={() => void changeStatus("archived")}
          >
            Archive
          </LoadingButton>
        </div>
      </article>
      <p className="admin-storage-note">Replies are not sent by this dashboard. Use the customer&apos;s email address in your configured mail client.</p>
    </>
  );
}
