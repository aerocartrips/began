"use client";

import { useSyncExternalStore } from "react";
import { isClientApiError } from "@/lib/api/api-error";
import { notificationApi } from "@/features/notifications/notification-api";
import type { NotificationScope } from "@/features/notifications/types";

const POLL_INTERVAL_MS = Math.max(5_000, Number(process.env.NEXT_PUBLIC_NOTIFICATION_POLL_INTERVAL_MS) || 30_000);
/** Focus/visibility refreshes closer together than this reuse the last result. */
const MIN_REFRESH_GAP_MS = 3_000;

type Snapshot = {
  /** null until the first successful fetch. */
  unreadCount: number | null;
  /** Bumped whenever polling observes a server-side change, so open lists know to reload. */
  revision: number;
};

const SERVER_SNAPSHOT: Snapshot = { unreadCount: null, revision: 0 };

/**
 * One poller per scope, shared by every mounted consumer (header bell, inbox page),
 * so mounting several components never multiplies requests. Polls only while the
 * tab is visible, and stops for good on 401/403 until remounted after sign-in.
 *
 * Stopping never aborts the request in flight (a tiny GET): it finishes quietly
 * and its answer is ignored. Aborting gained nothing, could surface as an
 * unhandled AbortError wherever fetch is wrapped (devtools, extensions), and left
 * a quick remount waiting a whole poll interval for its first count.
 */
export class UnreadStore {
  private snapshot: Snapshot = SERVER_SNAPSHOT;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Bumped by stop(): answers to requests sent before it are ignored. */
  private generation = 0;
  private inflight: { generation: number; promise: Promise<void> } | null = null;
  private lastFetchedAt = 0;
  private unauthorized = false;

  constructor(private readonly scope: NotificationScope) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) this.start();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stop();
    };
  };

  getSnapshot = () => this.snapshot;

  /** Applies a count returned by a local action (mark read) without signalling list reloads. */
  setLocal = (unreadCount: number) => {
    if (this.snapshot.unreadCount === unreadCount) return;
    this.emit({ ...this.snapshot, unreadCount });
  };

  refresh = (force = false): Promise<void> => {
    if (this.unauthorized || this.listeners.size === 0) return Promise.resolve();
    if (this.inflight?.generation === this.generation) return this.inflight.promise;
    if (!force && Date.now() - this.lastFetchedAt < MIN_REFRESH_GAP_MS) return Promise.resolve();

    const generation = this.generation;
    const current = () => generation === this.generation;
    const promise: Promise<void> = notificationApi
      .unreadCount(this.scope)
      .then((unreadCount) => {
        if (!current()) return;
        this.lastFetchedAt = Date.now();
        const { unreadCount: previous, revision } = this.snapshot;
        if (previous !== unreadCount) this.emit({ unreadCount, revision: previous === null ? revision : revision + 1 });
      })
      .catch((error: unknown) => {
        if (!current()) return;
        if (isClientApiError(error) && (error.status === 401 || error.status === 403)) {
          this.unauthorized = true;
          this.clearTimer();
          this.emit({ ...this.snapshot, unreadCount: 0 });
        }
        // Network errors: keep the last known count and try again next tick.
      })
      .finally(() => {
        if (this.inflight?.promise === promise) this.inflight = null;
        if (current()) this.schedule();
      });
    this.inflight = { generation, promise };
    return promise;
  };

  private emit(next: Snapshot) {
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }

  private schedule() {
    this.clearTimer();
    if (this.unauthorized || this.listeners.size === 0 || document.visibilityState !== "visible") return;
    this.timer = setTimeout(() => void this.refresh(true), POLL_INTERVAL_MS);
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private onVisibilityChange = () => {
    if (document.visibilityState === "visible") void this.refresh();
    else this.clearTimer();
  };

  private start() {
    this.unauthorized = false;
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    window.addEventListener("focus", this.onVisibilityChange);
    void this.refresh(true);
  }

  private stop() {
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    window.removeEventListener("focus", this.onVisibilityChange);
    this.clearTimer();
    // A request still in flight finishes quietly; its answer belongs to the old generation.
    this.generation += 1;
    this.snapshot = SERVER_SNAPSHOT;
  }
}

const stores: Record<NotificationScope, UnreadStore> = {
  customer: new UnreadStore("customer"),
  admin: new UnreadStore("admin"),
};

export function useUnreadNotifications(scope: NotificationScope) {
  const store = stores[scope];
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, () => SERVER_SNAPSHOT);
  return { ...snapshot, refresh: store.refresh, setUnreadCount: store.setLocal };
}
