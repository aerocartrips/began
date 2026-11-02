"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import LoadingButton from "@/components/ui/buttons/loading-button";
import OrderStatusBadge, { formatOrderStatus } from "@/features/orders/order-status-badge";
import { formatDate, formatDateTime } from "@/lib/format";

type TrackedOrder = {
  orderNumber: string;
  placedAt: string;
  orderStatus: string;
  paymentStatus: string;
  itemCount: number;
  items: { name: string; colorName: string; quantity: number }[];
  timeline: { status: string; at: string }[];
  shipment: {
    carrier: string;
    awb: string;
    status: string;
    estimatedDelivery: string | null;
    events: { status?: string; location?: string; time?: string; remarks?: string }[];
  } | null;
};

export default function TrackOrderClient() {
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/v1/orders/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber: form.get("orderNumber"), contact: form.get("contact") }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setOrder(null);
        setError(payload.message ?? "We could not find an order with those details.");
        return;
      }
      setOrder(payload.data);
    } catch {
      setError("We could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="content-page content-width">
      <header className="content-page__header">
        <h1>Track your order</h1>
        <p>Enter your order number and the email or phone number used at checkout.</p>
      </header>

      <form className="track-order-form" onSubmit={onSubmit}>
        <label className="contact-field">
          Order number
          <input name="orderNumber" required minLength={6} maxLength={40} autoComplete="off" placeholder="e.g. AUR-20261102-K3F9QZ" />
        </label>
        <label className="contact-field">
          Email or phone
          <input name="contact" required minLength={5} maxLength={254} autoComplete="email" placeholder="you@company.com or 98765 43210" />
        </label>
        <LoadingButton type="submit" loading={pending} loadingText="Looking up…">Track order</LoadingButton>
      </form>
      {error ? <p className="contact-submit-error" role="alert">{error}</p> : null}

      {order ? (
        <section className="track-order-result" aria-live="polite">
          <header>
            <h2>Order {order.orderNumber}</h2>
            <p>Placed {formatDate(order.placedAt)} · {order.itemCount} pieces</p>
            <div className="track-order-badges">
              <OrderStatusBadge kind="order" status={order.orderStatus} />
              <OrderStatusBadge kind="payment" status={order.paymentStatus} />
            </div>
          </header>
          <ul className="track-order-items">
            {order.items.map((item, index) => (
              <li key={`${item.name}-${index}`}>{item.quantity} × {item.name}{item.colorName ? ` (${item.colorName})` : ""}</li>
            ))}
          </ul>
          {order.shipment ? (
            <div className="track-order-shipment">
              <h3>Shipment</h3>
              <p>
                {order.shipment.carrier} · AWB {order.shipment.awb}
                {order.shipment.status ? ` · ${order.shipment.status}` : ""}
                {order.shipment.estimatedDelivery ? ` · Expected by ${formatDate(order.shipment.estimatedDelivery)}` : ""}
              </p>
              {order.shipment.events.length > 0 ? (
                <ol className="track-order-events">
                  {order.shipment.events.map((entry, index) => (
                    <li key={index}>
                      <strong>{entry.status ?? entry.remarks}</strong>
                      <span>{[entry.location, entry.time ? formatDateTime(entry.time) : ""].filter(Boolean).join(" · ")}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          ) : (
            <p>Tracking details will appear once your order ships.</p>
          )}
          {order.timeline.length > 0 ? (
            <ol className="track-order-events">
              {order.timeline.map((entry, index) => (
                <li key={index}>
                  <strong>{formatOrderStatus(entry.status)}</strong>
                  <span>{formatDateTime(entry.at)}</span>
                </li>
              ))}
            </ol>
          ) : null}
          <p>
            Have an account? <Link href="/account/orders">View all your orders</Link> for invoices, returns and support.
          </p>
        </section>
      ) : null}
    </main>
  );
}
