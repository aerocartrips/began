"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BellPlus, BellRing } from "lucide-react";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { apiRequest } from "@/lib/api/api-client";
import { isClientApiError } from "@/lib/api/api-error";
import { authHref } from "@/lib/auth/redirect";

type State = "loading" | "signed-out" | "subscribed" | "unsubscribed";

/** Explicit opt-in to a one-time back-in-stock notification for an unavailable product. */
export default function StockAlertButton({ productId }: { productId: string }) {
  const feedback = useFeedback();
  const pathname = usePathname();
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const endpoint = `/api/v1/products/${encodeURIComponent(productId)}/stock-alert`;
  // The static fallback catalog has no database ids, so alerts cannot be stored for it.
  const persistable = /^[a-f\d]{24}$/i.test(productId);

  useEffect(() => {
    if (!persistable) return;
    const controller = new AbortController();
    apiRequest<{ subscribed: boolean }>(endpoint, { signal: controller.signal })
      .then((result) => setState(result.data?.subscribed ? "subscribed" : "unsubscribed"))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState(isClientApiError(error) && error.status === 401 ? "signed-out" : "unsubscribed");
      });
    return () => controller.abort();
  }, [endpoint, persistable]);

  async function toggle() {
    const subscribe = state !== "subscribed";
    setBusy(true);
    try {
      await apiRequest(endpoint, { method: subscribe ? "PUT" : "DELETE" });
      setState(subscribe ? "subscribed" : "unsubscribed");
      if (subscribe) feedback.success("Alert set", "We will notify you when this product is back in stock.");
    } catch (error) {
      if (isClientApiError(error) && error.status === 401) setState("signed-out");
      else feedback.error("Could not update the alert", error instanceof Error ? error.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  if (!persistable || state === "loading") return null;

  if (state === "signed-out") {
    return (
      <Link className="stock-alert-button" href={authHref(pathname)}>
        <BellPlus size={14} aria-hidden="true" /> Sign in to get notified when available
      </Link>
    );
  }

  const subscribed = state === "subscribed";
  return (
    <button type="button" className="stock-alert-button" aria-pressed={subscribed} disabled={busy} onClick={() => void toggle()}>
      {subscribed ? <BellRing size={14} aria-hidden="true" /> : <BellPlus size={14} aria-hidden="true" />}
      {subscribed ? "You will be notified · Cancel alert" : "Notify me when available"}
    </button>
  );
}
