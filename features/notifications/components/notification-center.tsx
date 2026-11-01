"use client";

import { useState } from "react";
import { useFeedback } from "@/components/feedback/feedback-provider";
import NotificationList from "@/features/notifications/components/notification-list";
import { useUnreadNotifications } from "@/features/notifications/unread-store";
import { useNotificationList } from "@/features/notifications/use-notification-list";
import type { NotificationScope } from "@/features/notifications/types";

type Filter = "all" | "unread";

/** Full inbox shared by /account/notifications and /admin/notifications. */
export default function NotificationCenter({ scope }: { scope: NotificationScope }) {
  const feedback = useFeedback();
  const [filter, setFilter] = useState<Filter>("all");
  const { unreadCount } = useUnreadNotifications(scope);
  const list = useNotificationList(scope, { limit: 20, unreadOnly: filter === "unread" });

  function report(action: Promise<unknown>, title: string) {
    void action.catch((error: unknown) => feedback.error(title, error instanceof Error ? error.message : undefined));
  }

  return (
    <section className={`notification-center notification-center--${scope}`} aria-label="All notifications">
      <div className="notification-center__toolbar">
        <div className="notification-center__filters" role="group" aria-label="Filter notifications">
          {(["all", "unread"] as const).map((value) => (
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {value === "all" ? "All" : `Unread${unreadCount ? ` (${unreadCount > 99 ? "99+" : unreadCount})` : ""}`}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="text-button"
          disabled={!unreadCount}
          onClick={() => report(list.markAllRead(), "Could not mark notifications as read")}
        >
          Mark all as read
        </button>
      </div>

      <NotificationList
        items={list.items}
        status={list.status}
        skeletonRows={6}
        emptyTitle={filter === "unread" ? "No unread notifications" : "No notifications yet"}
        emptyDescription={
          scope === "admin"
            ? "Orders, payment issues, support activity and operational alerts will appear here."
            : "Updates about your orders, payments and support conversations will appear here."
        }
        onOpen={(notification) => report(list.markRead(notification.id), "Could not update notification")}
        onMarkRead={(notification) => report(list.markRead(notification.id), "Could not update notification")}
        onRetry={list.reload}
      />

      {list.hasMore ? (
        <div className="notification-center__more">
          <button
            type="button"
            className="text-button"
            disabled={list.loadingMore}
            onClick={() => report(list.loadMore(), "Could not load more notifications")}
          >
            {list.loadingMore ? "Loading…" : "Load older notifications"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
