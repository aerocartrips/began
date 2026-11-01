"use client";

import type { KeyboardEvent } from "react";
import { BellOff } from "lucide-react";
import Skeleton from "@/components/ui/loaders/skeleton";
import NotificationItem from "@/features/notifications/components/notification-item";
import type { AppNotification } from "@/features/notifications/types";

type NotificationListProps = {
  items: AppNotification[];
  status: "idle" | "loading" | "ready" | "error";
  skeletonRows?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  onOpen: (notification: AppNotification) => void;
  onMarkRead: (notification: AppNotification) => void;
  onRetry: () => void;
};

/** Arrow keys move between notifications; Tab still reaches the per-item actions. */
function handleArrowNavigation(event: KeyboardEvent<HTMLUListElement>) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const targets = [...event.currentTarget.querySelectorAll<HTMLElement>("[data-notification-item]")];
  const index = targets.indexOf(document.activeElement as HTMLElement);
  const next = targets[index + (event.key === "ArrowDown" ? 1 : -1)] ?? targets[event.key === "ArrowDown" ? 0 : targets.length - 1];
  if (next) {
    event.preventDefault();
    next.focus();
  }
}

export default function NotificationList({
  items,
  status,
  skeletonRows = 4,
  emptyTitle = "You're all caught up",
  emptyDescription = "Updates about your orders, payments and support conversations will appear here.",
  onOpen,
  onMarkRead,
  onRetry,
}: NotificationListProps) {
  if (status === "loading" || status === "idle") {
    return (
      <div className="notification-skeleton" role="status" aria-label="Loading notifications">
        {Array.from({ length: skeletonRows }, (_, index) => (
          <div key={index} className="notification-skeleton__row">
            <Skeleton className="notification-skeleton__icon" rounded="pill" />
            <div>
              <Skeleton className="notification-skeleton__title" />
              <Skeleton className="notification-skeleton__text" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (status === "error" && items.length === 0) {
    return (
      <div className="notification-state" role="alert">
        <strong>Notifications could not be loaded</strong>
        <p>Check your connection and try again.</p>
        <button type="button" className="text-button" onClick={onRetry}>Try again</button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="notification-state">
        <span className="notification-state__icon" aria-hidden="true">
          <BellOff size={20} strokeWidth={1.6} />
        </span>
        <strong>{emptyTitle}</strong>
        <p>{emptyDescription}</p>
      </div>
    );
  }

  return (
    <ul className="notification-list" onKeyDown={handleArrowNavigation}>
      {items.map((notification) => (
        <NotificationItem key={notification.id} notification={notification} onOpen={onOpen} onMarkRead={onMarkRead} />
      ))}
    </ul>
  );
}
