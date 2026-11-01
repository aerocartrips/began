"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isClientApiError } from "@/lib/api/api-error";
import { createRequestKey, type ThreadApi } from "@/features/support/support-api";
import type { PendingMessage, ThreadMessage } from "@/features/support/types";

const DEFAULT_POLL_MS = Number(process.env.NEXT_PUBLIC_SUPPORT_POLL_INTERVAL_MS) || 8000;
const MAX_BACKOFF_MS = 60_000;

function compareMessages(a: ThreadMessage, b: ThreadMessage) {
  const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  return diff !== 0 ? diff : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function mergeMessages(current: ThreadMessage[], incoming: ThreadMessage[]) {
  if (!incoming.length) return current;
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort(compareMessages);
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isAbort(error: unknown) {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (isClientApiError(error) && error.cause instanceof DOMException && error.cause.name === "AbortError")
  );
}

type UseSupportThreadOptions<TConversation> = {
  /** Stable for the lifetime of the component; remount (via `key`) to switch conversations. */
  api: ThreadApi<TConversation>;
  initial?: { items: ThreadMessage[]; hasMore: boolean };
  unreadCountOf: (conversation: TConversation) => number;
  onConversation?: (conversation: TConversation) => void;
  onMarkedRead?: () => void;
  onAuthError?: () => void;
  pollIntervalMs?: number;
};

export function useSupportThread<TConversation>({
  api,
  initial,
  unreadCountOf,
  onConversation,
  onMarkedRead,
  onAuthError,
  pollIntervalMs = DEFAULT_POLL_MS,
}: UseSupportThreadOptions<TConversation>) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initial?.items ?? []);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [hasOlder, setHasOlder] = useState(initial?.hasMore ?? false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(initial ? "ready" : "loading");
  const [error, setError] = useState("");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [connectionIssue, setConnectionIssue] = useState(false);

  const messagesRef = useRef<ThreadMessage[]>(initial?.items ?? []);
  const unmountedRef = useRef(false);
  const markingReadRef = useRef(false);
  const callbacksRef = useRef({ unreadCountOf, onConversation, onMarkedRead, onAuthError });
  useEffect(() => {
    callbacksRef.current = { unreadCountOf, onConversation, onMarkedRead, onAuthError };
  });

  const commit = useCallback((incoming: ThreadMessage[]) => {
    const merged = mergeMessages(messagesRef.current, incoming);
    if (merged === messagesRef.current) return;
    messagesRef.current = merged;
    setMessages(merged);
    const confirmedKeys = new Set(incoming.map((message) => message.clientMessageId).filter(Boolean));
    if (confirmedKeys.size) {
      setPending((current) => current.filter((item) => !confirmedKeys.has(item.clientMessageId)));
    }
  }, []);

  const markReadIfNeeded = useCallback(
    (conversation: TConversation | null) => {
      if (!conversation || markingReadRef.current) return;
      if (callbacksRef.current.unreadCountOf(conversation) <= 0) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      markingReadRef.current = true;
      api
        .markRead()
        .then(() => callbacksRef.current.onMarkedRead?.())
        .catch(() => {})
        .finally(() => {
          markingReadRef.current = false;
        });
    },
    [api],
  );

  const handleConversation = useCallback(
    (conversation: TConversation | null) => {
      if (!conversation) return;
      callbacksRef.current.onConversation?.(conversation);
      markReadIfNeeded(conversation);
    },
    [markReadIfNeeded],
  );

  const handleFailure = useCallback((failure: unknown) => {
    if (isClientApiError(failure) && failure.status === 401) callbacksRef.current.onAuthError?.();
  }, []);

  // Initial load (skipped when the server already rendered the first page) and polling.
  const [reloadToken, setReloadToken] = useState(0);
  useEffect(() => {
    unmountedRef.current = false;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let polling = false;
    let delay = pollIntervalMs;
    let loaded = Boolean(initial && reloadToken === 0);

    const schedule = (ms: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void poll(), ms);
    };

    async function poll() {
      timer = null;
      if (controller.signal.aborted || polling) return;
      // Hidden tabs stop polling; visibilitychange resumes it.
      if (document.visibilityState !== "visible") return;
      polling = true;
      try {
        const newest = messagesRef.current.at(-1)?.cursor;
        const page = await api.fetchMessages(newest ? { after: newest } : {}, controller.signal);
        if (controller.signal.aborted) return;
        commit(page.items);
        handleConversation(page.conversation);
        setConnectionIssue(false);
        delay = pollIntervalMs;
        schedule(page.hasMore ? 0 : delay);
      } catch (failure) {
        if (controller.signal.aborted || isAbort(failure)) return;
        handleFailure(failure);
        setConnectionIssue(true);
        delay = Math.min(delay * 2, MAX_BACKOFF_MS);
        schedule(delay);
      } finally {
        polling = false;
      }
    }

    async function loadInitial() {
      try {
        const page = await api.fetchMessages({}, controller.signal);
        if (controller.signal.aborted) return;
        commit(page.items);
        setHasOlder(page.hasMore);
        setStatus("ready");
        loaded = true;
        handleConversation(page.conversation);
        schedule(delay);
      } catch (failure) {
        if (controller.signal.aborted || isAbort(failure)) return;
        handleFailure(failure);
        setError(errorMessage(failure, "We could not load this conversation."));
        setStatus("error");
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible" && loaded && !timer && !polling) schedule(0);
    }

    if (initial && reloadToken === 0) schedule(delay);
    else void loadInitial();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      unmountedRef.current = true;
      controller.abort();
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // `initial` is only read for the first load on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, commit, handleConversation, handleFailure, pollIntervalMs, reloadToken]);

  const reload = useCallback(() => {
    setStatus("loading");
    setError("");
    setReloadToken((value) => value + 1);
  }, []);

  const loadOlder = useCallback(async () => {
    const oldest = messagesRef.current[0]?.cursor;
    if (!oldest || loadingOlder || !hasOlder) return false;
    setLoadingOlder(true);
    try {
      const page = await api.fetchMessages({ before: oldest });
      if (unmountedRef.current) return false;
      commit(page.items);
      setHasOlder(page.hasMore);
      return true;
    } catch (failure) {
      handleFailure(failure);
      throw failure;
    } finally {
      if (!unmountedRef.current) setLoadingOlder(false);
    }
  }, [api, commit, handleFailure, hasOlder, loadingOlder]);

  const deliver = useCallback(
    async (item: PendingMessage) => {
      try {
        const result = await api.sendMessage(item.body, item.clientMessageId);
        if (unmountedRef.current) return;
        commit([result.message]);
        setPending((current) => current.filter((entry) => entry.localId !== item.localId));
        handleConversation(result.conversation);
      } catch (failure) {
        if (unmountedRef.current) return;
        handleFailure(failure);
        const message = errorMessage(failure, "Message not sent.");
        setPending((current) =>
          current.map((entry) => (entry.localId === item.localId ? { ...entry, status: "failed", error: message } : entry)),
        );
        throw failure;
      }
    },
    [api, commit, handleConversation, handleFailure],
  );

  const send = useCallback(
    (body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return Promise.resolve();
      const key = createRequestKey();
      const item: PendingMessage = {
        localId: key,
        clientMessageId: key,
        body: trimmed,
        createdAt: new Date().toISOString(),
        status: "sending",
      };
      setPending((current) => [...current, item]);
      return deliver(item);
    },
    [deliver],
  );

  /** Retries with the same idempotency key, so a send that actually reached the server is not duplicated. */
  const retry = useCallback(
    (item: PendingMessage) => {
      const next: PendingMessage = { ...item, status: "sending", error: undefined };
      setPending((current) => current.map((entry) => (entry.localId === item.localId ? next : entry)));
      return deliver(next);
    },
    [deliver],
  );

  const discard = useCallback((localId: string) => {
    setPending((current) => current.filter((entry) => entry.localId !== localId));
  }, []);

  return {
    messages,
    pending,
    hasOlder,
    status,
    error,
    loadingOlder,
    connectionIssue,
    reload,
    loadOlder,
    send,
    retry,
    discard,
  };
}
