"use client";

import { useState } from "react";
import LoadingButton from "@/components/ui/buttons/LoadingButton";
import { useFeedback } from "@/components/feedback/FeedbackProvider";

type DownloadInvoiceButtonProps = {
  orderId: string;
  disabled?: boolean;
};

export default function DownloadInvoiceButton({ orderId, disabled }: DownloadInvoiceButtonProps) {
  const feedback = useFeedback();
  const [loading, setLoading] = useState(false);

  async function download() {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/orders/${encodeURIComponent(orderId)}/invoice`, {
        credentials: "include",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || "Could not download invoice.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? "invoice.pdf";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      feedback.success("Invoice ready", "Your invoice download has started.");
    } catch (error) {
      feedback.error("Invoice unavailable", error instanceof Error ? error.message : "Try again later.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <LoadingButton type="button" variant="secondary" loading={loading} disabled={disabled} onClick={() => void download()}>
      Download invoice
    </LoadingButton>
  );
}
