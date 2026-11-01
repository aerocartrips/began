"use client";

import { memo } from "react";
import { useIsClient } from "@/components/ui/client-formatted-time";
import SupportStatusBadge from "@/components/support/chat/support-status-badge";
import { categoryLabel } from "@/features/support/support-labels";
import type { CustomerConversation } from "@/features/support/types";
import { formatRelativeTime } from "@/lib/format";

type ConversationListProps = {
  items: CustomerConversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const ConversationCard = memo(function ConversationCard({
  conversation,
  selected,
  onSelect,
}: {
  conversation: CustomerConversation;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const isClient = useIsClient();
  const unread = conversation.unreadCount > 0;
  const preview = conversation.lastMessagePreview
    ? `${conversation.lastMessageFrom === "customer" ? "You: " : ""}${conversation.lastMessagePreview}`
    : "No messages yet";

  return (
    <li>
      <button
        type="button"
        className={["support-card", selected && "is-selected", unread && "is-unread"].filter(Boolean).join(" ")}
        aria-current={selected ? "true" : undefined}
        onClick={() => onSelect(conversation.id)}
      >
        <span className="support-card__top">
          <span className="support-card__category">{categoryLabel(conversation.category)}</span>
          <time dateTime={conversation.lastMessageAt}>{isClient ? formatRelativeTime(conversation.lastMessageAt) : ""}</time>
        </span>
        <span className="support-card__subject">
          {conversation.subject}
          {unread ? (
            <span className="support-card__unread">
              <span className="sr-only">, </span>
              {conversation.unreadCount}
              <span className="sr-only"> unread</span>
            </span>
          ) : null}
        </span>
        <span className="support-card__preview">{preview}</span>
        <span className="support-card__bottom">
          <SupportStatusBadge status={conversation.status} />
          {conversation.order?.orderNumber ? <span className="support-card__order">{conversation.order.orderNumber}</span> : null}
        </span>
      </button>
    </li>
  );
});

export default function ConversationList({ items, selectedId, onSelect }: ConversationListProps) {
  return (
    <ul className="support-list" aria-label="Your conversations">
      {items.map((conversation) => (
        <ConversationCard
          key={conversation.id}
          conversation={conversation}
          selected={conversation.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}
