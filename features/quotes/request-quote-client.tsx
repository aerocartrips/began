"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Trash2 } from "lucide-react";
import LoadingButton from "@/components/ui/buttons/loading-button";
import QuantitySelector from "@/components/ui/quantity-selector";
import EmptyState from "@/components/ui/empty-state";
import Button from "@/components/ui/button";
import { useCartItems } from "@/features/cart/cart-store";
import { useCartPricing } from "@/features/cart/use-cart-pricing";
import { useHydrated } from "@/lib/client/persistent-store";
import { formatNumber, formatRupees } from "@/lib/format";

export type QuoteLine = {
  productId: string;
  variantId: string | null;
  name: string;
  colorName: string;
  imageUrl: string;
  minimumQuantity: number;
  listUnitPrice: number;
  quantity: number;
};

type Submitted = { quoteNumber: string; signedIn: boolean };

/** Adds the current cart's lines when the page was opened with ?from=cart. */
function useCartLines(enabled: boolean): QuoteLine[] | null {
  const hydrated = useHydrated();
  const items = useCartItems();
  const { pricing } = useCartPricing(enabled && hydrated ? items : []);
  if (!enabled) return [];
  if (!hydrated || (items.length > 0 && !pricing)) return null;
  return (pricing?.lines ?? [])
    .filter((line) => !line.unavailable)
    .map((line) => ({
      productId: line.productId,
      variantId: line.variantId,
      name: line.name ?? "",
      colorName: line.colorName ?? "",
      imageUrl: line.imageUrl ?? "",
      minimumQuantity: line.minimumQuantity ?? 1,
      listUnitPrice: line.unitPrice ?? 0,
      quantity: line.quantity,
    }));
}

export default function RequestQuoteClient({ initialLines, fromCart, signedIn }: {
  initialLines: QuoteLine[];
  fromCart: boolean;
  signedIn: boolean;
}) {
  const cartLines = useCartLines(fromCart);
  const [edits, setEdits] = useState<Record<string, Partial<QuoteLine> & { removed?: boolean; target?: string; notes?: string }>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState<Submitted | null>(null);

  const keyOf = (line: QuoteLine) => `${line.productId}:${line.variantId ?? ""}`;
  const lines = [...initialLines, ...(cartLines ?? [])]
    .filter((line, index, all) => all.findIndex((other) => keyOf(other) === keyOf(line)) === index)
    .map((line) => ({ ...line, ...edits[keyOf(line)] }))
    .filter((line) => !edits[keyOf(line)]?.removed);

  const edit = (line: QuoteLine, changes: Record<string, unknown>) =>
    setEdits((current) => ({ ...current, [keyOf(line)]: { ...current[keyOf(line)], ...changes } }));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    setPending(true);
    setErrors({});
    try {
      const response = await fetch("/api/v1/quotes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact: { name: text("name"), email: text("email"), phone: text("phone"), companyName: text("companyName"), gstin: text("gstin") },
          items: lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            quantity: line.quantity,
            targetUnitPrice: edits[keyOf(line)]?.target ? Number(edits[keyOf(line)]?.target) : null,
            notes: edits[keyOf(line)]?.notes ?? "",
          })),
          message: text("message"),
          requirements: {
            customBranding: form.get("customBranding") === "on",
            customPackaging: form.get("customPackaging") === "on",
            deliveryPincode: text("deliveryPincode"),
            neededBy: text("neededBy") || null,
          },
          website: text("website"),
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        const fieldErrors: Record<string, string> = { form: payload.message ?? "Your request could not be sent." };
        for (const issue of payload.errors ?? []) fieldErrors[issue.field] ??= issue.message;
        setErrors(fieldErrors);
        return;
      }
      setSubmitted({ quoteNumber: payload.data.quoteNumber, signedIn });
    } catch {
      setErrors({ form: "We could not reach the server. Please try again." });
    } finally {
      setPending(false);
    }
  }

  if (submitted) {
    return (
      <main className="content-page content-width">
        <EmptyState
          icon={<CheckCircle2 size={20} />}
          title={`Quote request ${submitted.quoteNumber} sent`}
          description="Our team will review your request and reply by email, usually within one working day."
          action={submitted.signedIn ? <Button href="/account/quotes">View my quotes</Button> : <Button href="/products">Continue browsing</Button>}
        />
      </main>
    );
  }

  const error = (field: string) => (errors[field] ? <span className="contact-field-error">{errors[field]}</span> : null);

  return (
    <main className="content-page content-width quote-page">
      <header className="content-page__header">
        <h1>Request a quote</h1>
        <p>Tell us what you need. We will reply with per-piece prices, delivery charges and a validity date.</p>
      </header>

      <form onSubmit={onSubmit} className="quote-form" noValidate>
        <section aria-labelledby="quote-products">
          <h2 id="quote-products">Products</h2>
          {cartLines === null ? <p role="status">Loading your cart…</p> : null}
          {cartLines !== null && lines.length === 0 ? (
            <p>
              No products yet. <Link href="/products">Browse the catalogue</Link> and use “Request a quote”, or{" "}
              <Link href="/request-quote?from=cart">quote your cart</Link>.
            </p>
          ) : null}
          <ul className="quote-lines">
            {lines.map((line) => (
              <li key={keyOf(line)} className="quote-line">
                <span className="cart-line__image">
                  {line.imageUrl ? <Image src={line.imageUrl} alt="" fill sizes="72px" className="cover-image" /> : null}
                </span>
                <div>
                  <strong>{line.name}</strong>
                  <p className="cart-line__meta">
                    {line.colorName ? `${line.colorName} · ` : ""}List price {formatRupees(line.listUnitPrice)}/piece · MOQ {formatNumber(line.minimumQuantity)}
                  </p>
                  <label className="quote-line__field">
                    Target price per piece (optional)
                    <input type="number" min={0} step="0.01" value={edits[keyOf(line)]?.target ?? ""} onChange={(event) => edit(line, { target: event.currentTarget.value })} />
                  </label>
                  <label className="quote-line__field">
                    Notes
                    <input maxLength={1000} value={edits[keyOf(line)]?.notes ?? ""} onChange={(event) => edit(line, { notes: event.currentTarget.value })} />
                  </label>
                </div>
                <div className="cart-line__actions">
                  <QuantitySelector value={line.quantity} minimum={1} maximum={1000000} onChange={(quantity) => edit(line, { quantity })} />
                  <button type="button" className="icon-button" aria-label={`Remove ${line.name}`} onClick={() => edit(line, { removed: true })}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {error("items")}
        </section>

        <section aria-labelledby="quote-requirements">
          <h2 id="quote-requirements">Requirements</h2>
          <div className="contact-form-grid">
            <label className="contact-field"><span><input type="checkbox" name="customBranding" /> Custom branding or labels</span></label>
            <label className="contact-field"><span><input type="checkbox" name="customPackaging" /> Custom packaging</span></label>
            <label className="contact-field">
              Delivery PIN code
              <input name="deliveryPincode" inputMode="numeric" maxLength={6} pattern="\d{6}" />
              {error("requirements.deliveryPincode")}
            </label>
            <label className="contact-field">
              Needed by
              <input name="neededBy" type="date" />
            </label>
            <label className="contact-field contact-field-wide">
              Anything else we should know?
              <textarea name="message" rows={4} maxLength={4000} />
            </label>
          </div>
        </section>

        <section aria-labelledby="quote-contact">
          <h2 id="quote-contact">Your details</h2>
          <div className="contact-form-grid">
            <label className="contact-field">Full name<input name="name" required maxLength={120} autoComplete="name" />{error("contact.name")}</label>
            <label className="contact-field">Email<input name="email" type="email" required maxLength={254} autoComplete="email" />{error("contact.email")}</label>
            <label className="contact-field">Phone<input name="phone" type="tel" maxLength={25} autoComplete="tel" /></label>
            <label className="contact-field">Company<input name="companyName" maxLength={160} autoComplete="organization" /></label>
            <label className="contact-field">GSTIN<input name="gstin" maxLength={15} />{error("contact.gstin")}</label>
          </div>
          <div className="contact-honeypot" aria-hidden="true">
            <label>Leave this field empty<input name="website" tabIndex={-1} autoComplete="off" /></label>
          </div>
        </section>

        {errors.form ? <p className="contact-submit-error" role="alert">{errors.form}</p> : null}
        <LoadingButton type="submit" loading={pending} loadingText="Sending…" disabled={lines.length === 0}>
          Send quote request
        </LoadingButton>
      </form>
    </main>
  );
}
