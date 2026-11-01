"use client";

import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, RotateCw } from "lucide-react";
import Spinner from "@/components/ui/loaders/spinner";
import { useIsClient } from "@/components/ui/client-formatted-time";
import { formatDayLabel, formatTime } from "@/lib/format";
import type { PendingMessage, ThreadMessage, ThreadSender } from "@/features/support/types";

const NEAR_BOTTOM_PX = 120;

type ThreadItem = {
  key: string;
  body: string;
  createdAt: string;
  own: boolean;
  sender: ThreadSender;
  state: "sent" | "sending" | "failed";
  error?: string;
  pending?: PendingMessage;
};

type MessageThreadProps = {
  messages: ThreadMessage[];
  pending: PendingMessage[];
  /** Which side of the conversation is looking at it. */
  viewer: "customer" | "support";
  senderLabels: Record<ThreadSender, string>;
  hasOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  onRetry: (item: PendingMessage) => void;
  onDiscard: (localId: string) => void;
  emptyHint?: string;
};

function dayKey(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

const MessageBubble = memo(function MessageBubble({
  item,
  label,
  showMeta,
  onRetry,
  onDiscard,
}: {
  item: ThreadItem;
  label: string;
  showMeta: boolean;
  onRetry: (item: PendingMessage) => void;
  onDiscard: (localId: string) => void;
}) {
  const isClient = useIsClient();
  const sideClass = item.sender === "system" ? "is-system" : item.own ? "is-own" : "is-other";
  return (
    <li className={`support-bubble ${sideClass} is-${item.state}`}>
      {showMeta && !item.own && item.sender !== "system" ? <span className="support-bubble__sender">{label}</span> : null}
      <div className="support-bubble__body">
        <p>{item.body}</p>
      </div>
      <div className="support-bubble__meta">
        {item.state === "sending" ? <span>Sending…</span> : null}
        {item.state === "failed" && item.pending ? (
          <>
            <span className="support-bubble__error" role="alert">{item.error || "Not sent"}</span>
            <button type="button" onClick={() => onRetry(item.pending!)}>
              <RotateCw size={11} aria-hidden="true" /> Retry
            </button>
            <button type="button" onClick={() => onDiscard(item.pending!.localId)}>Discard</button>
          </>
        ) : null}
        {item.state === "sent" ? (
          <time dateTime={item.createdAt}>
            {isClient ? formatTime(item.createdAt) : ""}
            <span className="sr-only">{` from ${label}`}</span>
          </time>
        ) : null}
      </div>
    </li>
  );
});

export default function MessageThread({
  messages,
  pending,
  viewer,
  senderLabels,
  hasOlder,
  loadingOlder,
  onLoadOlder,
  onRetry,
  onDiscard,
  emptyHint,
}: MessageThreadProps) {
  const isClient = useIsClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const previousRef = useRef<{ first?: string; last?: string; height: number }>({ height: 0 });
  const [showJump, setShowJump] = useState(false);
  // Reuse item objects for unchanged messages so memoised bubbles skip re-rendering on each poll.
  const [itemCache] = useState(() => new WeakMap<ThreadMessage, ThreadItem>());

  const items = useMemo<ThreadItem[]>(() => {
    const confirmed: ThreadItem[] = messages.map((message) => {
      let item = itemCache.get(message);
      if (!item || item.own !== (message.sender === viewer)) {
        item = {
          key: message.id,
          body: message.body,
          createdAt: message.createdAt,
          own: message.sender === viewer,
          sender: message.sender,
          state: "sent",
        };
        itemCache.set(message, item);
      }
      return item;
    });
    const local: ThreadItem[] = pending.map((entry) => ({
      key: entry.localId,
      body: entry.body,
      createdAt: entry.createdAt,
      own: true,
      sender: viewer,
      state: entry.status,
      error: entry.error,
      pending: entry,
    }));
    return [...confirmed, ...local];
  }, [itemCache, messages, pending, viewer]);

  // Keep the reader's place: stay pinned to the bottom only if they were already
  // there (or just sent something); keep position steady when older pages load.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const first = items[0]?.key;
    const last = items.at(-1)?.key;
    const previous = previousRef.current;

    if (previous.first && first !== previous.first && last === previous.last) {
      element.scrollTop += element.scrollHeight - previous.height;
    } else if (last !== previous.last) {
      if (!previous.last || nearBottomRef.current || items.at(-1)?.own) {
        element.scrollTop = element.scrollHeight;
        setShowJump(false);
      } else {
        setShowJump(true);
      }
    }
    previousRef.current = { first, last, height: element.scrollHeight };
  }, [items]);

  function handleScroll() {
    const element = scrollRef.current;
    if (!element) return;
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_BOTTOM_PX;
    nearBottomRef.current = nearBottom;
    if (nearBottom && showJump) setShowJump(false);
    if (element.scrollTop < 60 && hasOlder && !loadingOlder) onLoadOlder();
  }

  function jumpToLatest() {
    const element = scrollRef.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
    setShowJump(false);
  }

  let previousDay = "";
  let previousSender = "";

  return (
    <div className="support-thread">
      <div
        ref={scrollRef}
        className="support-thread__scroll"
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Conversation messages"
        tabIndex={0}
      >
        {hasOlder ? (
          <div className="support-thread__older">
            <button type="button" onClick={onLoadOlder} disabled={loadingOlder}>
              {loadingOlder ? <Spinner size="sm" label="Loading earlier messages" /> : "Load earlier messages"}
            </button>
          </div>
        ) : items.length ? (
          <p className="support-thread__start">Start of conversation</p>
        ) : null}

        {!items.length && emptyHint ? <p className="support-thread__empty">{emptyHint}</p> : null}

        <ol className="support-thread__list">
          {items.map((item) => {
            const day = dayKey(item.createdAt);
            const showDay = day !== previousDay;
            const showMeta = showDay || item.sender !== previousSender;
            previousDay = day;
            previousSender = item.sender;
            return (
              <MessageGroupItem
                key={item.key}
                item={item}
                dayLabel={showDay && isClient ? formatDayLabel(item.createdAt) : showDay ? " " : ""}
                label={senderLabels[item.sender]}
                showMeta={showMeta}
                onRetry={onRetry}
                onDiscard={onDiscard}
              />
            );
          })}
        </ol>
      </div>

      {showJump ? (
        <button type="button" className="support-thread__jump" onClick={jumpToLatest}>
          <ArrowDown size={13} aria-hidden="true" /> New messages
        </button>
      ) : null}
    </div>
  );
}

function MessageGroupItem({
  item,
  dayLabel,
  ...rest
}: {
  item: ThreadItem;
  dayLabel: string;
  label: string;
  showMeta: boolean;
  onRetry: (item: PendingMessage) => void;
  onDiscard: (localId: string) => void;
}) {
  return (
    <>
      {dayLabel ? (
        <li className="support-thread__day" aria-hidden={dayLabel.trim() ? undefined : true}>
          <span>{dayLabel}</span>
        </li>
      ) : null}
      <MessageBubble item={item} {...rest} />
    </>
  );
}
