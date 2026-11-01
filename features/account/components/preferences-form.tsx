"use client";

import { useState } from "react";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { accountApi } from "@/features/account/account-api";
import { formatDate } from "@/lib/format";
import type { NotificationPreferences } from "@/features/account/types";

type PreferenceKey = "orderUpdates" | "shippingUpdates" | "promotional";

const OPTIONS: { key: PreferenceKey; title: string; description: string }[] = [
  {
    key: "orderUpdates",
    title: "Order updates",
    description: "Confirmations, cancellations, returns and refund progress for your orders.",
  },
  {
    key: "shippingUpdates",
    title: "Shipping and delivery",
    description: "Dispatch, tracking and delivery notices from our logistics partners.",
  },
  {
    key: "promotional",
    title: "Promotions and new collections",
    description: "Occasional emails about new batches, offers and trade events. Off unless you opt in.",
  },
];

/** Each toggle saves immediately and rolls back if the request fails. */
export default function PreferencesForm({ initialPreferences }: { initialPreferences: NotificationPreferences }) {
  const feedback = useFeedback();
  const [preferences, setPreferences] = useState(initialPreferences);
  const [pending, setPending] = useState<PreferenceKey | null>(null);

  async function toggle(key: PreferenceKey, value: boolean) {
    const previous = preferences;
    setPreferences({ ...previous, [key]: value });
    setPending(key);
    try {
      const result = await accountApi.updatePreferences({ [key]: value });
      if (result.data) setPreferences(result.data);
      feedback.success("Preferences saved", undefined, `preferences-${key}`);
    } catch (error) {
      setPreferences(previous);
      feedback.error("Preference not saved", error instanceof Error ? error.message : undefined);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="account-stack">
      <section className="account-panel" aria-labelledby="preferences-email-title">
        <div className="account-panel-head">
          <h2 id="preferences-email-title">Email notifications</h2>
        </div>
        <ul className="account-toggle-list">
          {OPTIONS.map((option) => (
            <li key={option.key}>
              <label className="account-toggle">
                <span className="account-toggle-copy">
                  <strong>{option.title}</strong>
                  <small>{option.description}</small>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={preferences[option.key]}
                  disabled={pending === option.key}
                  aria-busy={pending === option.key}
                  onChange={(event) => void toggle(option.key, event.currentTarget.checked)}
                />
                <span className="account-switch" aria-hidden="true" />
              </label>
            </li>
          ))}
        </ul>
        {preferences.promotional && preferences.promotionalConsentAt ? (
          <p className="account-footnote">Marketing consent given on {formatDate(preferences.promotionalConsentAt)}.</p>
        ) : null}
        <p className="account-muted">
          Payment receipts, invoices, password and security alerts are always sent, regardless of these settings.
          Turning off promotions never affects order or delivery notices.
        </p>
      </section>

      <section className="account-panel" aria-labelledby="preferences-region-title">
        <div className="account-panel-head">
          <h2 id="preferences-region-title">Language and currency</h2>
        </div>
        <dl className="account-facts">
          <div><dt>Language</dt><dd>English</dd></div>
          <div><dt>Currency</dt><dd>Indian Rupee (INR)</dd></div>
        </dl>
        <p className="account-muted">The Norosilk storefront and invoices are currently available in English and INR only.</p>
      </section>
    </div>
  );
}
