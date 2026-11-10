"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Bell, CheckCheck } from "lucide-react";
import CountBadge, { badgeCount } from "@/components/ui/count-badge";
import NotificationList from "@/features/notifications/components/notification-list";
import { INBOX_PATH } from "@/features/notifications/notification-api";
import { useUnreadNotifications } from "@/features/notifications/unread-store";
import { useNotificationList } from "@/features/notifications/use-notification-list";
import type { AppNotification, NotificationScope } from "@/features/notifications/types";

const DROPDOWN_LIMIT = 8;

export default function NotificationBell({ scope }: { scope: NotificationScope }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const { unreadCount } = useUnreadNotifications(scope);
  const list = useNotificationList(scope, { limit: DROPDOWN_LIMIT, enabled: open });
  const badge = badgeCount(unreadCount);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function openNotification(notification: AppNotification) {
    void list.markRead(notification.id).catch(() => undefined);
    setOpen(false);
  }

  return (
    <div className={`notification-bell notification-bell--${scope}`} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="nav-icon-button notification-bell__trigger"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={badge ? `Notifications, ${badge} unread` : "Notifications"}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={scope === "admin" ? 16 : 18} strokeWidth={1.8} aria-hidden="true" />
        <CountBadge count={unreadCount} corner />
      </button>

      {open ? (
        <div className="notification-panel" id={panelId} role="dialog" aria-label="Notifications">
          <div className="notification-panel__head">
            <div className="notification-panel__title">
              <h2>Notifications</h2>
              <CountBadge count={unreadCount} label="new" />
            </div>
            {unreadCount ? (
              <button
                type="button"
                className="notification-panel__mark-all"
                onClick={() => void list.markAllRead().catch(() => undefined)}
              >
                <CheckCheck size={13} aria-hidden="true" /> Mark all read
              </button>
            ) : null}
          </div>
          <div className="notification-panel__body">
            <NotificationList
              items={list.items}
              status={list.status}
              skeletonRows={3}
              onOpen={openNotification}
              onMarkRead={(notification) => void list.markRead(notification.id).catch(() => undefined)}
              onRetry={list.reload}
            />
          </div>
          <Link className="notification-panel__footer" href={INBOX_PATH[scope]} onClick={() => setOpen(false)}>
            View all notifications <ArrowRight size={12} aria-hidden="true" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
