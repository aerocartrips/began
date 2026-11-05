/**
 * "The shopper signed in or out", sent to the store's other open tabs
 * (BroadcastChannel is per origin, so per store; the sending tab never hears
 * its own message). Receivers re-render their server-rendered session UI, so
 * no tab has to poll the API to notice.
 */
const CHANNEL = "auth-session";

export function announceSessionChange() {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(CHANNEL);
  channel.postMessage("changed");
  channel.close();
}

/** Calls `listener` when another tab signs in or out; returns the unsubscribe function. */
export function onSessionChange(listener: () => void) {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel(CHANNEL);
  channel.addEventListener("message", listener);
  return () => channel.close();
}
