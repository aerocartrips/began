"use client";

import { useCallback, useEffect, useState } from "react";
import { notificationApi } from "@/features/notifications/notification-api";
import { useUnreadNotifications } from "@/features/notifications/unread-store";
import type { AppNotification, NotificationScope } from "@/features/notifications/types";

type Status = "idle" | "loading" | "ready" | "error";

type Options = {
  limit?: number;
  unreadOnly?: boolean;
  /** Lists inside a closed dropdown stay idle and do not fetch. */
  enabled?: boolean;
};

export function useNotificationList(scope: NotificationScope, { limit = 20, unreadOnly = false, enabled = true }: Options = {}) {
  const { revision, setUnreadCount } = useUnreadNotifications(scope);
  const queryKey = `${scope}|${limit}|${unreadOnly}`;
  const [items, setItems] = useState<AppNotification[]>([]);
  /** Outcome of the last load and the query it was for; a different query reads as "loading". */
  const [result, setResult] = useState<{ key: string | null; status: Status }>({ key: null, status: "idle" });
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [reloadToken, setReloadToken] = useState(0);

  // Loads the first page initially, on reload, and whenever polling sees new activity on the server.
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    notificationApi
      .list(scope, { limit, unreadOnly, signal: controller.signal })
      .then((page) => {
        if (controller.signal.aborted) return;
        setItems(page.items);
        setCursor(page.nextCursor);
        setHasMore(page.hasMore);
        setUnreadCount(page.unreadCount);
        setResult({ key: queryKey, status: "ready" });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key: queryKey, status: "error" });
      });
    return () => controller.abort();
  }, [enabled, limit, queryKey, reloadToken, revision, scope, setUnreadCount, unreadOnly]);

  const reload = useCallback(() => {
    setResult({ key: queryKey, status: "loading" });
    setReloadToken((value) => value + 1);
  }, [queryKey]);

  const status: Status = !enabled && result.key === null ? "idle" : result.key === queryKey ? result.status : "loading";

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await notificationApi.list(scope, { cursor, limit, unreadOnly });
      setItems((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...page.items.filter((item) => !seen.has(item.id))];
      });
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, limit, loadingMore, scope, unreadOnly]);

  const markRead = useCallback(
    async (id: string) => {
      const target = items.find((item) => item.id === id);
      if (!target || target.isRead) return;
      setItems((current) => current.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
      try {
        setUnreadCount(await notificationApi.markRead(scope, id));
      } catch (error) {
        setItems((current) => current.map((item) => (item.id === id ? { ...item, isRead: false } : item)));
        throw error;
      }
    },
    [items, scope, setUnreadCount],
  );

  const markAllRead = useCallback(async () => {
    const previous = items;
    setItems((current) => current.map((item) => ({ ...item, isRead: true })));
    try {
      setUnreadCount(await notificationApi.markAllRead(scope));
    } catch (error) {
      setItems(previous);
      throw error;
    }
  }, [items, scope, setUnreadCount]);

  return { items, status, hasMore, loadingMore, reload, loadMore, markRead, markAllRead };
}
