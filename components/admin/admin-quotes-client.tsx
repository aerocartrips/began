"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import AdminStatusChip from "@/components/admin/admin-status-chip";
import AdminCard from "@/components/admin/admin-card";
import LoadingButton from "@/components/ui/buttons/loading-button";
import { DatePicker, todayIso } from "@/components/ui/form/date-picker";
import ErrorCard from "@/components/ui/feedback/error-card";
import TableSkeleton from "@/components/ui/loaders/table-skeleton";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { useApiRequest } from "@/hooks/use-api-request";
import { sendJson } from "@/lib/api/send-json";
import { QUOTE_ADMIN_TRANSITIONS, QUOTE_STATUS_LABELS } from "@/lib/constants/quote-status";
import { formatDate, formatDateTime, formatNumber, formatRupees } from "@/lib/format";
import type { CustomerQuote } from "@/features/quotes/customer-quotes";

type QuoteRow = {
  id: string;
  quoteNumber: string;
  contact: { name: string; email: string; companyName: string };
  itemCount: number;
  pieces: number;
  status: string;
  totals: { total: number };
  createdAt: string;
};

type AdminQuote = CustomerQuote & {
  contact: { name: string; email: string; phone: string; companyName: string; gstin: string };
  requirements: { customBranding: boolean; customPackaging: boolean; deliveryPincode: string; neededBy: string | null };
  internalNotes: string;
};

const label = (status: string) => QUOTE_STATUS_LABELS[status as keyof typeof QUOTE_STATUS_LABELS] ?? status;

export function AdminQuoteList() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const endpoint = useMemo(() => `/api/v1/admin/quotes?limit=25&page=${page}${status ? `&status=${status}` : ""}`, [page, status]);
  const { loading, error, data, meta, refetch } = useApiRequest<QuoteRow[]>(endpoint);
  const pageCount = Math.max(1, Math.ceil(Number(meta?.total ?? 0) / 25));

  return (
    <>
      <AdminPageHeading eyebrow="Sales" title="Quotes" description="Wholesale quote requests from buyers." />
      <div className="admin-product-filters">
        <label>
          <span className="sr-only">Filter by status</span>
          <select value={status} onChange={(event) => { setStatus(event.currentTarget.value); setPage(1); }}>
            <option value="">All statuses</option>
            {Object.entries(QUOTE_STATUS_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        </label>
      </div>
      {error ? <ErrorCard title="Unable to load quotes" description={error} action={<LoadingButton onClick={() => void refetch()}>Retry</LoadingButton>} /> : null}
      {loading && !data ? (
        <TableSkeleton rows={6} />
      ) : !data?.length ? (
        <div className="admin-empty-results" role="status">No quote requests yet.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th scope="col">Quote</th><th scope="col">Buyer</th><th scope="col">Received</th><th scope="col" className="is-numeric">Pieces</th><th scope="col">Status</th><th scope="col" className="is-numeric">Value</th></tr>
            </thead>
            <tbody>
              {data.map((quote) => (
                <tr key={quote.id}>
                  <td><Link href={`/admin/quotes/${quote.id}`}>{quote.quoteNumber}</Link></td>
                  <td>
                    <strong>{quote.contact.companyName || quote.contact.name}</strong>
                    <small className="admin-cell-sub">{quote.contact.email}</small>
                  </td>
                  <td>{formatDate(quote.createdAt)}</td>
                  <td className="is-numeric">{formatNumber(quote.pieces)}</td>
                  <td><AdminStatusChip status={quote.status} label={label(quote.status)} /></td>
                  <td className="is-numeric">{formatRupees(quote.totals.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pageCount > 1 ? (
        <nav className="catalog-pagination" aria-label="Quote pages">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span aria-current="page">Page {page} of {pageCount}</span>
          <button type="button" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>Next</button>
        </nav>
      ) : null}
    </>
  );
}

export function AdminQuoteDetail({ quoteId }: { quoteId: string }) {
  const feedback = useFeedback();
  const endpoint = `/api/v1/admin/quotes/${encodeURIComponent(quoteId)}`;
  const { loading, error, data, refetch } = useApiRequest<AdminQuote>(endpoint);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [form, setForm] = useState<{ shipping?: string; validUntil?: string; responseNotes?: string; internalNotes?: string }>({});
  const [saving, setSaving] = useState<string | null>(null);

  if (loading && !data) return <TableSkeleton rows={6} />;
  if (error || !data) return <ErrorCard title="Quote unavailable" description={error || "Not found."} />;

  const priceFor = (item: AdminQuote["items"][number]) => prices[item.id] ?? (item.quotedUnitPrice != null ? String(item.quotedUnitPrice) : "");
  const subtotal = data.items.reduce((sum, item) => sum + (Number(priceFor(item)) || item.listUnitPrice) * item.quantity, 0);
  const shipping = Number(form.shipping ?? data.response.shippingCharges ?? 0) || 0;
  const transitions = QUOTE_ADMIN_TRANSITIONS[data.status as keyof typeof QUOTE_ADMIN_TRANSITIONS] ?? [];

  async function save(status?: string) {
    setSaving(status ?? "save");
    try {
      await sendJson(endpoint, "PATCH", {
        ...(status ? { status } : {}),
        items: data!.items.map((item) => ({ id: item.id, quotedUnitPrice: priceFor(item) === "" ? null : Number(priceFor(item)) })),
        ...(form.shipping !== undefined ? { shippingCharges: form.shipping === "" ? null : Number(form.shipping) } : {}),
        ...(form.validUntil !== undefined ? { validUntil: form.validUntil || null } : {}),
        ...(form.responseNotes !== undefined ? { responseNotes: form.responseNotes } : {}),
        ...(form.internalNotes !== undefined ? { internalNotes: form.internalNotes } : {}),
      });
      feedback.success(status === "quoted" ? "Quote sent to the buyer" : "Quote saved");
      setPrices({});
      setForm({});
      await refetch();
    } catch (cause) {
      feedback.error("Quote not saved", cause instanceof Error ? cause.message : undefined);
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <AdminPageHeading
        eyebrow="Quote"
        title={data.quoteNumber}
        description={`${label(data.status)} · received ${formatDateTime(data.createdAt)}`}
        action={<Link className="button button-glass button-sm" href="/admin/quotes">All quotes</Link>}
      />
      <div className="admin-detail-grid">
        <AdminCard title="Products and pricing" description="Enter your price per piece for each line, then send the quote.">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th scope="col">Product</th><th scope="col" className="is-numeric">Pieces</th><th scope="col" className="is-numeric">List</th><th scope="col" className="is-numeric">Target</th><th scope="col" className="is-numeric">Your price</th></tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.productName}</strong>
                      <small className="admin-cell-sub">{[item.colorName, item.sku, item.notes].filter(Boolean).join(" · ")}</small>
                    </td>
                    <td className="is-numeric">{formatNumber(item.quantity)}</td>
                    <td className="is-numeric">{formatRupees(item.listUnitPrice)}</td>
                    <td className="is-numeric">{item.targetUnitPrice != null ? formatRupees(item.targetUnitPrice) : "—"}</td>
                    <td className="is-numeric">
                      <input
                        className="admin-inline-input"
                        type="number"
                        min={0}
                        step="0.01"
                        aria-label={`Price per piece for ${item.productName}`}
                        value={priceFor(item)}
                        onChange={(event) => setPrices({ ...prices, [item.id]: event.currentTarget.value })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-form-grid">
            <label className="admin-field">
              Shipping (₹)
              <input type="number" min={0} step="0.01" value={form.shipping ?? (data.response.shippingCharges ?? "")} onChange={(event) => setForm({ ...form, shipping: event.currentTarget.value })} />
            </label>
            <DatePicker
              className="admin-field"
              label="Valid until"
              min={todayIso()}
              value={form.validUntil ?? (data.response.validUntil ? data.response.validUntil.slice(0, 10) : "")}
              onChange={(validUntil) => setForm({ ...form, validUntil })}
            />
            <label className="admin-field admin-field-wide">
              Message to the buyer
              <textarea rows={3} value={form.responseNotes ?? data.response.notes} onChange={(event) => setForm({ ...form, responseNotes: event.currentTarget.value })} />
            </label>
            <label className="admin-field admin-field-wide">
              Internal notes (not shown to the buyer)
              <textarea rows={2} value={form.internalNotes ?? data.internalNotes} onChange={(event) => setForm({ ...form, internalNotes: event.currentTarget.value })} />
            </label>
          </div>
          <p className="admin-card__footnote">Total {formatRupees(subtotal + shipping)} excluding GST.</p>
          <div className="admin-form-actions">
            <LoadingButton type="button" variant="secondary" size="sm" loading={saving === "save"} disabled={saving !== null} onClick={() => void save()}>Save draft</LoadingButton>
            {transitions.includes("quoted") ? (
              <LoadingButton type="button" size="sm" loading={saving === "quoted"} disabled={saving !== null} onClick={() => void save("quoted")}>
                {data.status === "quoted" ? "Update and resend" : "Send quote"}
              </LoadingButton>
            ) : null}
            {transitions.filter((next) => next !== "quoted").map((next) => (
              <LoadingButton key={next} type="button" variant="secondary" size="sm" loading={saving === next} disabled={saving !== null} onClick={() => void save(next)}>
                Mark {label(next).toLowerCase()}
              </LoadingButton>
            ))}
          </div>
        </AdminCard>

        <AdminCard title="Buyer">
          <dl className="admin-detail-list">
            <div><dt>Name</dt><dd>{data.contact.name}</dd></div>
            <div><dt>Email</dt><dd><a href={`mailto:${data.contact.email}`}>{data.contact.email}</a></dd></div>
            {data.contact.phone ? <div><dt>Phone</dt><dd>{data.contact.phone}</dd></div> : null}
            {data.contact.companyName ? <div><dt>Company</dt><dd>{data.contact.companyName}</dd></div> : null}
            {data.contact.gstin ? <div><dt>GSTIN</dt><dd>{data.contact.gstin}</dd></div> : null}
            <div><dt>Branding</dt><dd>{data.requirements.customBranding ? "Requested" : "No"}</dd></div>
            <div><dt>Packaging</dt><dd>{data.requirements.customPackaging ? "Requested" : "No"}</dd></div>
            {data.requirements.deliveryPincode ? <div><dt>Deliver to</dt><dd>{data.requirements.deliveryPincode}</dd></div> : null}
            {data.requirements.neededBy ? <div><dt>Needed by</dt><dd>{formatDate(data.requirements.neededBy)}</dd></div> : null}
          </dl>
          {data.message ? <p className="quote-response-notes">{data.message}</p> : null}
          <h3>History</h3>
          <ol className="track-order-events">
            {data.history.map((entry, index) => (
              <li key={index}>
                <strong>{label(entry.status)}</strong>
                <span>{formatDateTime(entry.at)} · {entry.byRole}{entry.note ? ` · ${entry.note}` : ""}</span>
              </li>
            ))}
          </ol>
        </AdminCard>
      </div>
    </>
  );
}
