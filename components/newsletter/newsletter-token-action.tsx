"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Button from "@/components/ui/button";

type Action = "confirm" | "unsubscribe";
type State = { status: "idle" | "working" | "done" | "error"; message: string };

const COPY = {
  confirm: { working: "Confirming your subscription…", done: "You're subscribed. Thank you!", button: "Confirm subscription" },
  unsubscribe: { working: "Unsubscribing…", done: "You have been unsubscribed and won't receive further emails.", button: "Unsubscribe" },
} as const;

/**
 * Handles the links in newsletter emails. The change is made by a POST from
 * this page, never by opening the link itself, so email security scanners
 * that prefetch links cannot confirm or cancel a subscription. Confirmation
 * runs as soon as the page loads; unsubscribing waits for a click.
 */
export default function NewsletterTokenAction({ action }: { action: Action }) {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<State>({ status: "idle", message: "" });
  const started = useRef(false);

  const run = useCallback(async () => {
    setState({ status: "working", message: COPY[action].working });
    try {
      const response = await fetch(`/api/v1/newsletter/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const payload = await response.json().catch(() => null);
      setState(response.ok ? { status: "done", message: COPY[action].done } : { status: "error", message: payload?.message ?? "Something went wrong. Please try again." });
    } catch {
      setState({ status: "error", message: "We couldn't reach the store. Check your connection and try again." });
    }
  }, [action, token]);

  useEffect(() => {
    if (action !== "confirm" || !token || started.current) return;
    started.current = true;
    void run();
  }, [action, token, run]);

  if (!token) return <p role="alert">This link is incomplete. Please use the full link from your email.</p>;

  return (
    <div className="newsletter-action" aria-live="polite">
      {state.message ? <p role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}
      {state.status === "idle" || state.status === "error" ? (
        <Button type="button" onClick={() => void run()}>
          {state.status === "error" ? "Try again" : COPY[action].button}
        </Button>
      ) : null}
      {state.status === "done" ? <Button href="/products" variant="secondary">Continue shopping</Button> : null}
    </div>
  );
}
