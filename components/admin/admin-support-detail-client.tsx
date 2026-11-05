"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import AdminCard from "@/components/admin/admin-card";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import AdminStatusChip from "@/components/admin/admin-status-chip";
import LoadingButton from "@/components/ui/buttons/loading-button";
import Select from "@/components/ui/form/select";
import MessageComposer from "@/components/support/chat/message-composer";
import MessageThread from "@/components/support/chat/message-thread";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { adminThreadApi, updateAdminConversation } from "@/features/support/support-api";
import { categoryLabel, SUPPORT_MESSAGE_MAX } from "@/features/support/support-labels";
import type { AdminConversationDetail, ThreadMessage } from "@/features/support/types";
import { useSupportThread } from "@/features/support/use-support-thread";
import { formatDateTime, humanizeStatus } from "@/lib/format";
import { useTenant } from "@/features/tenant/tenant-provider";

type SupportDetailProps = {
  conversation: AdminConversationDetail;
  initialMessages: ThreadMessage[];
  initialHasMore: boolean;
};

const STATUS_OPTIONS = ["open", "in_progress", "waiting_customer", "resolved", "closed"] as const;
const PRIORITY_OPTIONS = ["low", "normal", "high", "urgent"] as const;
const STATUS_SELECT_OPTIONS = STATUS_OPTIONS.map((value) => ({ id: value, label: humanizeStatus(value) }));
const PRIORITY_SELECT_OPTIONS = PRIORITY_OPTIONS.map((value) => ({ id: value, label: `${humanizeStatus(value)} priority` }));
const CLOSED_STATUSES = new Set(["resolved", "closed"]);


const unreadCountOf = (conversation: AdminConversationDetail) => conversation.unreadCount;

export default function AdminSupportDetailClient({
  conversation: initialConversation,
  initialMessages,
  initialHasMore,
}: SupportDetailProps) {
  const tenant = useTenant();
  const feedback = useFeedback();
  const [conversation, setConversation] = useState(initialConversation);
  const [notes, setNotes] = useState(initialConversation.internalNotes);
  const [savingField, setSavingField] = useState<"status" | "priority" | "notes" | null>(null);
  const conversationId = initialConversation.conversationId;

  const api = useMemo(() => adminThreadApi(conversationId), [conversationId]);
  const [initial] = useState(() => ({ items: initialMessages, hasMore: initialHasMore }));
  const thread = useSupportThread<AdminConversationDetail>({
    api,
    initial,
    unreadCountOf,
    // Polls refresh status/unread, but never overwrite notes being edited.
    onConversation: useCallback((next: AdminConversationDetail) => setConversation(next), []),
    onMarkedRead: useCallback(() => setConversation((current) => ({ ...current, unread: false, unreadCount: 0 })), []),
  });

  const { send: sendMessage } = thread;
  const sendReply = useCallback(
    (body: string) =>
      sendMessage(body).catch((error: unknown) => {
        feedback.error("Reply not sent", error instanceof Error ? error.message : "Try again.", "admin-support-send");
      }),
    [feedback, sendMessage],
  );

  async function update(field: "status" | "priority" | "notes", payload: Parameters<typeof updateAdminConversation>[1]) {
    setSavingField(field);
    try {
      const next = await updateAdminConversation(conversationId, payload);
      setConversation(next);
      if (field === "notes") setNotes(next.internalNotes);
      feedback.success(
        field === "notes" ? "Notes saved" : field === "status" ? "Status updated" : "Priority updated",
        field === "status" ? `Conversation marked ${humanizeStatus(next.status).toLowerCase()}.` : undefined,
      );
    } catch (error) {
      feedback.error("Update failed", error instanceof Error ? error.message : "Try again.");
    } finally {
      setSavingField(null);
    }
  }

  const isClosed = CLOSED_STATUSES.has(conversation.status);

  return (
    <>
      <AdminPageHeading
        eyebrow="Support conversation"
        title={conversation.subject}
        description={`${conversation.name}${conversation.email ? ` · ${conversation.email}` : ""}`}
        action={
          <Link className="admin-back-link" href="/admin/messages">
            <ArrowLeft size={14} aria-hidden="true" /> Inbox
          </Link>
        }
      />

      <AdminCard
        className="admin-conversation"
        title={conversation.awaitingReply ? "Awaiting your reply" : "Conversation"}
        action={
          <div className="admin-heading-actions">
            <AdminStatusChip status={conversation.status} />
            <LoadingButton
              type="button"
              variant="secondary"
              size="sm"
              icon={<CheckCircle2 size={14} aria-hidden="true" />}
              loading={savingField === "status"}
              onClick={() => void update("status", { status: isClosed ? "open" : "resolved" })}
            >
              {isClosed ? "Reopen" : "Mark resolved"}
            </LoadingButton>
          </div>
        }
      >
        <dl className="admin-support-meta">
          <div>
            <dt>Customer</dt>
            <dd>
              {conversation.customerId ? (
                <Link href={`/admin/customers/${conversation.customerId}`}>{conversation.name}</Link>
              ) : (
                `${conversation.name} (guest)`
              )}
            </dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{conversation.email ? <a href={`mailto:${conversation.email}`}>{conversation.email}</a> : "—"}</dd>
          </div>
          {conversation.phone ? (
            <div>
              <dt>Phone</dt>
              <dd>{conversation.phone}</dd>
            </div>
          ) : null}
          <div>
            <dt>Topic</dt>
            <dd>{categoryLabel(conversation.category)}</dd>
          </div>
          <div>
            <dt>Order</dt>
            <dd>
              {conversation.orderId ? (
                <Link href={`/admin/orders/${conversation.orderId}`}>{conversation.orderNumber ?? "View order"}</Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{conversation.source === "account" ? "Customer account" : "Contact form"}</dd>
          </div>
          <div>
            <dt>Started</dt>
            <dd>{formatDateTime(conversation.createdAt)}</dd>
          </div>
        </dl>

        <div className="admin-toolbar">
          <Select
            label="Status"
            hideLabel
            options={STATUS_SELECT_OPTIONS}
            value={conversation.status}
            disabled={savingField !== null}
            onChange={(status) => void update("status", { status })}
          />
          <Select
            label="Priority"
            hideLabel
            options={PRIORITY_SELECT_OPTIONS}
            value={conversation.priority}
            disabled={savingField !== null}
            onChange={(priority) => void update("priority", { priority })}
          />
        </div>

        <div className="admin-support-thread">
          <MessageThread
            messages={thread.messages}
            pending={thread.pending}
            viewer="support"
            senderLabels={{ customer: "Customer", support: `${tenant.name} team`, system: "System" }}
            hasOlder={thread.hasOlder}
            loadingOlder={thread.loadingOlder}
            onLoadOlder={() => void thread.loadOlder().catch(() => feedback.error("Could not load earlier messages", "Try again."))}
            onRetry={(item) => void thread.retry(item).catch(() => {})}
            onDiscard={thread.discard}
            emptyHint="No messages in this conversation yet."
          />
          <MessageComposer
            onSend={sendReply}
            maxLength={SUPPORT_MESSAGE_MAX}
            label="Reply to customer"
            placeholder={conversation.customerId ? "Reply to the customer…" : "Reply… guests cannot view replies online, so follow up by email too."}
          />
        </div>
      </AdminCard>

      <AdminCard title="Internal notes">
        <label className="admin-field">
          <span className="sr-only">Internal notes</span>
          <textarea
            value={notes}
            rows={4}
            maxLength={4000}
            onChange={(event) => setNotes(event.currentTarget.value)}
            placeholder="Visible to the team only. Never shown to the customer."
          />
        </label>
        <div className="admin-form-actions">
          <LoadingButton
            type="button"
            size="sm"
            variant="secondary"
            loading={savingField === "notes"}
            disabled={notes === conversation.internalNotes}
            onClick={() => void update("notes", { internalNotes: notes })}
          >
            Save notes
          </LoadingButton>
        </div>
      </AdminCard>
    </>
  );
}
