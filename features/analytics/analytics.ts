/**
 * Storefront analytics client. Events are queued and sent in small batches
 * (on a short timer, when the queue fills, and when the page is hidden, via
 * sendBeacon), so tracking adds no requests on the critical path.
 * Only event names, section keys and ids/slugs/paths are sent.
 */

export type AnalyticsEventName =
  | "section_view"
  | "banner_click"
  | "category_click"
  | "product_click"
  | "link_click"
  | "search_submit"
  | "search_suggestion_click"
  | "wishlist_add"
  | "cart_add"
  | "feed_load"
  | "newsletter_signup";

type QueuedEvent = { event: AnalyticsEventName; section: string; target: string };

const ENDPOINT = "/api/v1/analytics/events";
const BATCH = 25;
const FLUSH_DELAY_MS = 4000;
const MAX_QUEUE = 200;

const queue: QueuedEvent[] = [];
let timer: number | undefined;
let listening = false;

function send(events: QueuedEvent[], useBeacon: boolean) {
  const body = JSON.stringify({ events });
  if (useBeacon && typeof navigator.sendBeacon === "function") {
    if (navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }))) return;
  }
  void fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => undefined);
}

export function flushAnalytics(useBeacon = false) {
  window.clearTimeout(timer);
  timer = undefined;
  while (queue.length) send(queue.splice(0, BATCH), useBeacon);
}

function listenForPageHide() {
  if (listening) return;
  listening = true;
  const onHide = () => flushAnalytics(true);
  window.addEventListener("pagehide", onHide);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") onHide();
  });
}

export function trackEvent(event: AnalyticsEventName, { section = "", target = "" }: { section?: string; target?: string } = {}) {
  if (typeof window === "undefined" || queue.length >= MAX_QUEUE) return;
  listenForPageHide();
  queue.push({ event, section, target: target.slice(0, 120) });
  if (queue.length >= BATCH) flushAnalytics();
  else if (timer === undefined) timer = window.setTimeout(() => flushAnalytics(), FLUSH_DELAY_MS);
}
