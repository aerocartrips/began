import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UnreadStore } from "@/features/notifications/unread-store";

/**
 * A browser-like fetch for the unread-count endpoint: answers after `delay` ms,
 * and rejects with the signal's reason when aborted (before or during the body),
 * exactly as Chrome does.
 */
function stubFetch({ delay = 30, unreadCount = 3 } = {}) {
  const calls = [];
  const fetch = vi.fn((url, init = {}) => {
    calls.push(url);
    return new Promise((resolve, reject) => {
      const { signal } = init;
      if (signal?.aborted) return reject(signal.reason);
      const timer = setTimeout(() => {
        const body = JSON.stringify({ success: true, data: { unreadCount } });
        resolve(new Response(body, { status: 200, headers: { "Content-Type": "application/json" } }));
      }, delay);
      signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(signal.reason);
      });
    });
  });
  return { fetch, calls };
}

const tick = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe("unread notification poller", () => {
  const unhandled = [];
  const onUnhandled = (reason) => unhandled.push(reason);

  beforeEach(() => {
    unhandled.length = 0;
    process.on("unhandledRejection", onUnhandled);
    const listeners = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal("document", { ...listeners, visibilityState: "visible" });
    vi.stubGlobal("window", { ...listeners, location: { pathname: "/" } });
  });

  afterEach(() => {
    process.off("unhandledRejection", onUnhandled);
    vi.unstubAllGlobals();
  });

  it("stops mid-request without leaving an unhandled rejection", async () => {
    const { fetch } = stubFetch({ delay: 50 });
    vi.stubGlobal("fetch", fetch);
    const store = new UnreadStore("customer");

    const unsubscribe = store.subscribe(() => {});
    await tick(5); // request in flight
    unsubscribe(); // last consumer gone: the poller stops
    await tick(120);

    expect(unhandled).toEqual([]);
    // The late answer belongs to the stopped poller: it changes nothing and schedules nothing.
    expect(store.getSnapshot().unreadCount).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("shows the count straight away when remounted while a request is in flight", async () => {
    const { fetch } = stubFetch({ delay: 40, unreadCount: 7 });
    vi.stubGlobal("fetch", fetch);
    const store = new UnreadStore("customer");

    // React's dev-mode double mount (and Fast Refresh) unsubscribe and resubscribe at once.
    store.subscribe(() => {})();
    store.subscribe(() => {});
    await tick(120);

    expect(store.getSnapshot().unreadCount).toBe(7);
    expect(unhandled).toEqual([]);
  });
});
