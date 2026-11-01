"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isClientApiError } from "@/lib/api/api-error";
import { fetchCustomerConversations } from "@/features/support/support-api";
import type { CustomerConversation } from "@/features/support/types";

const LIST_POLL_MS = Number(process.env.NEXT_PUBLIC_SUPPORT_LIST_POLL_INTERVAL_MS) || 30_000;

function sortByActivity(items: CustomerConversation[]) {
  return [...items].sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
}

function mergeConversations(current: CustomerConversation[], incoming: CustomerConversation[]) {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return sortByActivity([...byId.values()]);
}

export function useCustomerConversations({ onAuthError }: { onAuthError: () => void }) {
  const [items, setItems] = useState<CustomerConversation[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(1);
  const authErrorRef = useRef(onAuthError);
  useEffect(() => {
    authErrorRef.current = onAuthError;
  });

  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void refresh(), LIST_POLL_MS);
    };

    async function refresh() {
      timer = null;
      if (document.visibilityState !== "visible") return;
      try {
        const result = await fetchCustomerConversations(1, controller.signal);
        if (controller.signal.aborted) return;
        setItems((current) => mergeConversations(current, result.items));
      } catch {
        // Background refresh: keep showing what we have.
      }
      if (!controller.signal.aborted) schedule();
    }

    async function loadFirstPage() {
      try {
        const result = await fetchCustomerConversations(1, controller.signal);
        if (controller.signal.aborted) return;
        pageRef.current = 1;
        setItems(sortByActivity(result.items));
        setHasMore(result.hasMore);
        setStatus("ready");
        schedule();
      } catch (error) {
        if (controller.signal.aborted) return;
        if (isClientApiError(error) && error.status === 401) authErrorRef.current();
        setStatus("error");
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible" && !timer) void refresh();
    }

    void loadFirstPage();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [reloadToken]);

  const reload = useCallback(() => {
    setStatus("loading");
    setReloadToken((value) => value + 1);
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = pageRef.current + 1;
      const result = await fetchCustomerConversations(next);
      pageRef.current = next;
      setItems((current) => mergeConversations(current, result.items));
      setHasMore(result.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore]);

  const upsert = useCallback((conversation: CustomerConversation) => {
    setItems((current) => {
      const existing = current.find((item) => item.id === conversation.id);
      if (
        existing &&
        existing.status === conversation.status &&
        existing.unreadCount === conversation.unreadCount &&
        existing.lastMessageAt === conversation.lastMessageAt &&
        existing.canReply === conversation.canReply
      ) {
        return current;
      }
      return mergeConversations(current, [conversation]);
    });
  }, []);

  const markRead = useCallback((conversationId: string) => {
    setItems((current) =>
      current.some((item) => item.id === conversationId && item.unreadCount > 0)
        ? current.map((item) => (item.id === conversationId ? { ...item, unreadCount: 0 } : item))
        : current,
    );
  }, []);

  return { items, status, hasMore, loadingMore, loadMore, reload, upsert, markRead };
}
