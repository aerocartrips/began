"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import Button from "@/components/ui/button";
import ErrorCard from "@/components/ui/feedback/error-card";
import MessageComposer from "@/components/support/chat/message-composer";
import MessageThread from "@/components/support/chat/message-thread";
import SupportStatusBadge from "@/components/support/chat/support-status-badge";
import { ThreadSkeleton } from "@/components/support/chat/thread-skeleton";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { closeCustomerConversation, customerThreadApi } from "@/features/support/support-api";
import { categoryLabel, CUSTOMER_STATUS_COPY, SUPPORT_MESSAGE_MAX } from "@/features/support/support-labels";
import type { CustomerConversation } from "@/features/support/types";
import { useSupportThread } from "@/features/support/use-support-thread";
import { useTenant } from "@/features/tenant/tenant-provider";



type CustomerThreadProps = {
  conversation: CustomerConversation;
  onBack: () => void;
  onConversation: (conversation: CustomerConversation) => void;
  onMarkedRead: (conversationId: string) => void;
  onAuthError: () => void;
};

const unreadCountOf = (conversation: CustomerConversation) => conversation.unreadCount;

/** Mounted with `key={conversation.id}` so each conversation gets fresh thread state. */
export default function CustomerThread({ conversation, onBack, onConversation, onMarkedRead, onAuthError }: CustomerThreadProps) {
  const tenant = useTenant();
  const feedback = useFeedback();
  const api = useMemo(() => customerThreadApi(conversation.id), [conversation.id]);
  const [closing, setClosing] = useState(false);

  const thread = useSupportThread<CustomerConversation>({
    api,
    unreadCountOf,
    onConversation,
    onMarkedRead: useCallback(() => onMarkedRead(conversation.id), [conversation.id, onMarkedRead]),
    onAuthError,
  });

  const { send: sendMessage } = thread;
  const send = useCallback(
    (body: string) =>
      sendMessage(body).catch((error: unknown) => {
        feedback.error("Message not sent", error instanceof Error ? error.message : "Please try again.", "support-send");
      }),
    [feedback, sendMessage],
  );

  async function closeConversation() {
    if (!window.confirm("Close this conversation? You can start a new one any time.")) return;
    setClosing(true);
    try {
      onConversation(await closeCustomerConversation(conversation.id));
      feedback.success("Conversation closed", "Thanks for reaching out.");
    } catch (error) {
      feedback.error("Could not close conversation", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setClosing(false);
    }
  }

  const statusCopy = CUSTOMER_STATUS_COPY[conversation.status];
  const disabledReason = !conversation.canReply
    ? conversation.status === "resolved"
      ? "This conversation was resolved a while ago. Start a new conversation if you need more help."
      : "This conversation is closed. Start a new conversation if you need more help."
    : undefined;

  return (
    <section className="support-pane" aria-labelledby="support-thread-title">
      <header className="support-pane__header">
        <button type="button" className="support-icon-button support-pane__back" onClick={onBack} aria-label="Back to conversations">
          <ArrowLeft size={16} aria-hidden="true" />
        </button>
        <div className="support-pane__title">
          <h2 id="support-thread-title">{conversation.subject}</h2>
          <p>
            <span>{categoryLabel(conversation.category)}</span>
            {conversation.order ? (
              <>
                <span aria-hidden="true">·</span>
                <Link href={`/account/orders/${conversation.order.id}`}>{conversation.order.orderNumber ?? "View order"}</Link>
              </>
            ) : null}
          </p>
        </div>
        <div className="support-pane__actions">
          <SupportStatusBadge status={conversation.status} />
          {conversation.status !== "closed" ? (
            <button type="button" className="text-button" onClick={() => void closeConversation()} disabled={closing}>
              {closing ? "Closing…" : "Close"}
            </button>
          ) : null}
        </div>
      </header>

      <p className="support-pane__notice">
        {statusCopy.detail}
        {thread.connectionIssue ? <span className="support-pane__reconnecting"> · Reconnecting…</span> : null}
      </p>

      {thread.status === "loading" ? <ThreadSkeleton /> : null}
      {thread.status === "error" ? (
        <div className="support-pane__state">
          <ErrorCard
            title="Conversation unavailable"
            description={thread.error}
            action={<Button type="button" size="sm" onClick={thread.reload}>Try again</Button>}
          />
        </div>
      ) : null}
      {thread.status === "ready" ? (
        <MessageThread
          messages={thread.messages}
          pending={thread.pending}
          viewer="customer"
          senderLabels={{ customer: "You", support: `${tenant.name} support`, system: tenant.name }}
          hasOlder={thread.hasOlder}
          loadingOlder={thread.loadingOlder}
          onLoadOlder={() =>
            void thread.loadOlder().catch(() => feedback.error("Could not load earlier messages", "Please try again."))
          }
          onRetry={(item) => void thread.retry(item).catch(() => {})}
          onDiscard={thread.discard}
        />
      ) : null}

      <MessageComposer
        onSend={send}
        maxLength={SUPPORT_MESSAGE_MAX}
        disabled={!conversation.canReply || thread.status !== "ready"}
        disabledReason={disabledReason}
        placeholder={conversation.status === "resolved" ? "Reply to reopen this conversation…" : "Write a message…"}
      />
    </section>
  );
}
