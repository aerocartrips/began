"use client";

import { useState } from "react";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { accountApi } from "@/features/account/account-api";
import { formatDate } from "@/lib/format";
import type { NotificationPreferences } from "@/features/account/types";

type PreferenceKey = "orderUpdates" | "shippingUpdates" | "promotional" | "backInStock";
type PreferenceOption = { key: PreferenceKey; title: string; description: string };

const OPTIONS: PreferenceOption[] = [
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

const IN_APP_OPTIONS: PreferenceOption[] = [
  {
    key: "backInStock",
    title: "Back-in-stock alerts",
    description: "Tell me when a product I asked about can be ordered again. Only products you subscribe to.",
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
        <ToggleList options={OPTIONS} preferences={preferences} pending={pending} onToggle={toggle} />
        {preferences.promotional && preferences.promotionalConsentAt ? (
          <p className="account-footnote">Marketing consent given on {formatDate(preferences.promotionalConsentAt)}.</p>
        ) : null}
        <p className="account-muted">
          Payment receipts, invoices, password and security alerts are always sent, regardless of these settings.
          Turning off promotions never affects order or delivery notices.
        </p>
      </section>

      <section className="account-panel" aria-labelledby="preferences-in-app-title">
        <div className="account-panel-head">
          <h2 id="preferences-in-app-title">In-app notifications</h2>
        </div>
        <ToggleList options={IN_APP_OPTIONS} preferences={preferences} pending={pending} onToggle={toggle} />
        <p className="account-muted">
          Order, payment, delivery, refund and support updates always appear in your notifications, because they
          concern purchases you have made. An in-app notification does not mean an email was sent.
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

type ToggleListProps = {
  options: PreferenceOption[];
  preferences: NotificationPreferences;
  pending: PreferenceKey | null;
  onToggle: (key: PreferenceKey, value: boolean) => Promise<void>;
};

function ToggleList({ options, preferences, pending, onToggle }: ToggleListProps) {
  return (
    <ul className="account-toggle-list">
      {options.map((option) => (
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
              onChange={(event) => void onToggle(option.key, event.currentTarget.checked)}
            />
            <span className="account-switch" aria-hidden="true" />
          </label>
        </li>
      ))}
    </ul>
  );
}
