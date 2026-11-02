"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import EmptyState from "@/components/ui/empty-state";
import Button from "@/components/ui/button";
import LoadingButton from "@/components/ui/buttons/loading-button";
import ErrorCard from "@/components/ui/feedback/error-card";
import TableSkeleton from "@/components/ui/loaders/table-skeleton";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { useApiRequest } from "@/hooks/use-api-request";
import { sendJson } from "@/lib/api/send-json";
import { QUOTE_STATUS_LABELS } from "@/lib/constants/quote-status";
import { formatDate, formatNumber, formatRupees } from "@/lib/format";

export type CustomerQuote = {
  id: string;
  quoteNumber: string;
  status: string;
  items: {
    id: string;
    productName: string;
    productSlug: string;
    colorName: string;
    sku: string;
    quantity: number;
    targetUnitPrice: number | null;
    listUnitPrice: number;
    quotedUnitPrice: number | null;
    notes: string;
  }[];
  message: string;
  response: { shippingCharges: number | null; validUntil: string | null; notes: string; quotedAt: string | null };
  totals: { subtotal: number; shipping: number; total: number };
  history: { status: string; note: string; byRole: string; at: string }[];
  createdAt: string;
};

const statusLabel = (status: string) => QUOTE_STATUS_LABELS[status as keyof typeof QUOTE_STATUS_LABELS] ?? status;

export function CustomerQuoteList() {
  const { loading, error, data, refetch } = useApiRequest<CustomerQuote[]>("/api/v1/quotes");
  if (loading && !data) return <TableSkeleton rows={4} />;
  if (error) return <ErrorCard title="Quotes unavailable" description={error} action={<LoadingButton onClick={() => void refetch()}>Retry</LoadingButton>} />;
  if (!data?.length) {
    return (
      <EmptyState
        icon={<FileText size={20} />}
        title="No quote requests yet"
        description="Request pricing for bulk or custom orders from any product page or your cart."
        action={<Button href="/request-quote">Request a quote</Button>}
      />
    );
  }
  return (
    <div className="account-panel">
      <table className="quote-table">
        <thead>
          <tr><th scope="col">Quote</th><th scope="col">Requested</th><th scope="col">Items</th><th scope="col">Status</th><th scope="col" className="is-numeric">Total</th></tr>
        </thead>
        <tbody>
          {data.map((quote) => (
            <tr key={quote.id}>
              <td><Link href={`/account/quotes/${quote.id}`}>{quote.quoteNumber}</Link></td>
              <td>{formatDate(quote.createdAt)}</td>
              <td>{formatNumber(quote.items.reduce((sum, item) => sum + item.quantity, 0))} pcs</td>
              <td><span className={`quote-status is-${quote.status}`}>{statusLabel(quote.status)}</span></td>
              <td className="is-numeric">{quote.response.quotedAt ? formatRupees(quote.totals.total) : "Awaiting quote"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CustomerQuoteDetail({ quoteId }: { quoteId: string }) {
  const feedback = useFeedback();
  const { loading, error, data, refetch } = useApiRequest<CustomerQuote>(`/api/v1/quotes/${encodeURIComponent(quoteId)}`);
  const [responding, setResponding] = useState<"accept" | "decline" | null>(null);

  async function respond(decision: "accept" | "decline") {
    setResponding(decision);
    try {
      await sendJson(`/api/v1/quotes/${encodeURIComponent(quoteId)}/respond`, "POST", { decision });
      feedback.success(decision === "accept" ? "Quote accepted" : "Quote declined", decision === "accept" ? "Our team will be in touch to complete your order." : undefined);
      await refetch();
    } catch (cause) {
      feedback.error("Could not record your response", cause instanceof Error ? cause.message : undefined);
    } finally {
      setResponding(null);
    }
  }

  if (loading && !data) return <TableSkeleton rows={4} />;
  if (error || !data) return <ErrorCard title="Quote unavailable" description={error || "This quote could not be loaded."} action={<Button href="/account/quotes">Back to quotes</Button>} />;

  const quoted = Boolean(data.response.quotedAt);
  return (
    <div className="account-panel quote-detail">
      <header className="quote-detail__header">
        <div>
          <h2>Quote {data.quoteNumber}</h2>
          <p>Requested {formatDate(data.createdAt)}{data.response.validUntil ? ` · Valid until ${formatDate(data.response.validUntil)}` : ""}</p>
        </div>
        <span className={`quote-status is-${data.status}`}>{statusLabel(data.status)}</span>
      </header>
      <table className="quote-table">
        <thead>
          <tr><th scope="col">Product</th><th scope="col" className="is-numeric">Pieces</th><th scope="col" className="is-numeric">List</th><th scope="col" className="is-numeric">Your target</th><th scope="col" className="is-numeric">Offer</th></tr>
        </thead>
        <tbody>
          {data.items.map((item) => (
            <tr key={item.id}>
              <td>
                {item.productSlug ? <Link href={`/products/${item.productSlug}`}>{item.productName}</Link> : item.productName}
                {item.colorName ? <small> · {item.colorName}</small> : null}
                {item.notes ? <small className="quote-note">{item.notes}</small> : null}
              </td>
              <td className="is-numeric">{formatNumber(item.quantity)}</td>
              <td className="is-numeric">{formatRupees(item.listUnitPrice)}</td>
              <td className="is-numeric">{item.targetUnitPrice != null ? formatRupees(item.targetUnitPrice) : "—"}</td>
              <td className="is-numeric">{item.quotedUnitPrice != null ? <strong>{formatRupees(item.quotedUnitPrice)}</strong> : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {quoted ? (
        <dl className="quote-totals">
          <div><dt>Subtotal</dt><dd>{formatRupees(data.totals.subtotal)}</dd></div>
          <div><dt>Shipping</dt><dd>{formatRupees(data.totals.shipping)}</dd></div>
          <div><dt>Total (excluding GST)</dt><dd><strong>{formatRupees(data.totals.total)}</strong></dd></div>
        </dl>
      ) : (
        <p className="account-muted">Our team is preparing your quote. We will email you when it is ready.</p>
      )}
      {data.response.notes ? <p className="quote-response-notes">{data.response.notes}</p> : null}
      {data.status === "quoted" ? (
        <div className="quote-actions">
          <LoadingButton loading={responding === "accept"} disabled={responding !== null} onClick={() => void respond("accept")}>Accept quote</LoadingButton>
          <LoadingButton variant="secondary" loading={responding === "decline"} disabled={responding !== null} onClick={() => void respond("decline")}>Decline</LoadingButton>
        </div>
      ) : null}
    </div>
  );
}
