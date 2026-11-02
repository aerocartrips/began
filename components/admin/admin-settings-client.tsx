"use client";

import { useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import AdminCard from "@/components/admin/admin-card";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import AdminStatusChip from "@/components/admin/admin-status-chip";
import LoadingButton from "@/components/ui/buttons/loading-button";
import ErrorCard from "@/components/ui/feedback/error-card";
import TableSkeleton from "@/components/ui/loaders/table-skeleton";
import { useApiRequest } from "@/hooks/use-api-request";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { useAsyncAction } from "@/hooks/use-async-action";
import { apiRequest } from "@/lib/api/api-client";
import { formatDateTime } from "@/lib/format";

type SettingsSection = "store" | "branding" | "theme" | "contact" | "business" | "commerce" | "orders" | "shipping";
type Tab = SettingsSection | "integrations";
type SettingsValue = string | number;

type SettingsDoc = Record<SettingsSection, Record<string, SettingsValue>> & { version: number };

type HealthResponse = {
  checkedAt: string;
  integrations: { id: string; label: string; configured: boolean; status: string; lastError?: string }[];
};

type FieldConfig = {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "number" | "textarea" | "color" | "url" | "select";
  options?: { value: string; label: string }[];
  step?: string;
  fallback?: SettingsValue;
  hint?: string;
  wide?: boolean;
  transform?: (value: string) => string;
};

const upper = (value: string) => value.toUpperCase();

const TABS: { id: Tab; label: string; description: string }[] = [
  { id: "store", label: "Store", description: "Store name and how it sells." },
  { id: "branding", label: "Branding", description: "Title, tagline, logo and images shown on the storefront." },
  { id: "theme", label: "Colours", description: "Storefront colours. Changes apply to every page immediately." },
  { id: "contact", label: "Contact", description: "Contact details shown on the contact page, footer and emails." },
  { id: "business", label: "Business & GST", description: "Legal details printed on invoices, and where store alerts are sent." },
  { id: "commerce", label: "Tax & shipping", description: "GST and shipping charges added at checkout." },
  { id: "orders", label: "Orders", description: "Payment reservation, cancellation and return windows." },
  { id: "shipping", label: "Pickup", description: "Pickup location and default parcel details for courier booking." },
  { id: "integrations", label: "Integrations", description: "Connection health for third-party services." },
];

const colour = (name: string, label: string): FieldConfig => ({ name, label, type: "color" });

const FIELDS: Record<SettingsSection, FieldConfig[]> = {
  store: [
    { name: "name", label: "Store name" },
    {
      name: "salesMode",
      label: "Sales mode",
      type: "select",
      options: [
        { value: "wholesale", label: "Wholesale — MOQ, quantity tiers, quote requests" },
        { value: "retail", label: "Retail — single pieces at the retail price" },
      ],
      hint: "Changes prices, quantities and checkout rules across the whole storefront.",
      wide: true,
    },
  ],
  branding: [
    { name: "siteTitle", label: "Site title", hint: "Shown in browser tabs and search results" },
    { name: "tagline", label: "Home page headline" },
    { name: "description", label: "Short description", type: "textarea", wide: true, hint: "Used for search engines and the footer" },
    { name: "logoUrl", label: "Logo URL", type: "url", wide: true },
    { name: "heroImageUrl", label: "Home page image URL", type: "url", wide: true },
    { name: "faviconUrl", label: "Favicon URL", type: "url", wide: true },
  ],
  theme: [
    colour("brand", "Brand"),
    colour("brandSecondary", "Brand secondary"),
    colour("accent", "Accent"),
    colour("text", "Text"),
    colour("textMuted", "Muted text"),
    colour("background", "Page background"),
    colour("surface", "Cards"),
    colour("border", "Borders"),
  ],
  contact: [
    { name: "email", label: "Support email", type: "email" },
    { name: "phone", label: "Support phone", type: "tel" },
    { name: "hours", label: "Business hours" },
    { name: "address", label: "Business address", type: "textarea", wide: true },
    { name: "instagram", label: "Instagram URL", type: "url" },
    { name: "linkedin", label: "LinkedIn URL", type: "url" },
    { name: "x", label: "X URL", type: "url" },
  ],
  business: [
    { name: "legalName", label: "Legal name" },
    { name: "gstin", label: "GSTIN", transform: upper },
    { name: "invoicePrefix", label: "Invoice prefix", fallback: "INV", transform: upper },
    { name: "notificationEmail", label: "Alert inbox", type: "email", hint: "New orders, quotes and contact messages" },
    { name: "registeredAddress", label: "Registered address", type: "textarea", wide: true },
  ],
  commerce: [
    { name: "defaultGstRatePercent", label: "Default GST %", type: "number", step: "0.01", fallback: 0, hint: "For products without their own rate, and shipping" },
    { name: "shippingFlatAmount", label: "Shipping charge (₹)", type: "number", step: "0.01", fallback: 0 },
    { name: "shippingFreeThreshold", label: "Free shipping from (₹)", type: "number", step: "0.01", fallback: 0, hint: "0 turns free shipping off" },
    { name: "lowStockThreshold", label: "Low-stock alert at", type: "number", fallback: 5, hint: "Pieces remaining" },
  ],
  orders: [
    { name: "paymentReservationMinutes", label: "Payment reservation", type: "number", fallback: 30, hint: "Minutes stock is held for unpaid orders" },
    { name: "cancellationWindowHours", label: "Cancellation window", type: "number", fallback: 48, hint: "Hours after placing an order" },
    { name: "returnWindowDays", label: "Return window", type: "number", fallback: 7, hint: "Days after delivery" },
  ],
  shipping: [
    { name: "pickupLocationName", label: "Pickup location" },
    { name: "pickupPincode", label: "Pickup pincode" },
    { name: "defaultWeightKg", label: "Default weight (kg)", type: "number", step: "0.1", fallback: 1 },
    { name: "defaultBoxCount", label: "Default box count", type: "number", fallback: 1 },
    { name: "freightMode", label: "Freight mode", fallback: "prepaid" },
  ],
};

export default function AdminSettingsClient() {
  const feedback = useFeedback();
  const settingsRequest = useApiRequest<SettingsDoc>("/api/v1/admin/settings");
  const healthRequest = useApiRequest<HealthResponse>("/api/v1/admin/settings/health");
  const [tab, setTab] = useState<Tab>("store");
  const [draft, setDraft] = useState<Partial<Record<SettingsSection, Record<string, SettingsValue>>> | null>(null);

  const settings = settingsRequest.data;
  const merged = useMemo(() => {
    if (!settings) return null;
    const sections = Object.keys(FIELDS) as SettingsSection[];
    return Object.fromEntries(
      sections.map((section) => [section, { ...settings[section], ...draft?.[section] }]),
    ) as Record<SettingsSection, Record<string, SettingsValue>>;
  }, [settings, draft]);

  const { run: save, loading: saving } = useAsyncAction(async () => {
    if (!draft) return null;
    try {
      await apiRequest("/api/v1/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      feedback.success("Settings saved", "Store configuration updated.");
      setDraft(null);
      await settingsRequest.refetch();
    } catch (saveError) {
      feedback.error("Could not save settings", saveError instanceof Error ? saveError.message : "Try again.");
    }
    return null;
  });

  if (settingsRequest.loading && !settings) return <TableSkeleton rows={6} />;
  if (settingsRequest.error || !settings || !merged) {
    return (
      <ErrorCard
        title="Unable to load settings"
        description={settingsRequest.error || "Settings unavailable."}
        action={<LoadingButton onClick={() => void settingsRequest.refetch()}>Retry</LoadingButton>}
      />
    );
  }

  function patchField(section: SettingsSection, field: string, value: SettingsValue) {
    setDraft((current) => ({ ...current, [section]: { ...current?.[section], [field]: value } }));
  }

  const activeTab = TABS.find((item) => item.id === tab) ?? TABS[0];

  return (
    <>
      <AdminPageHeading
        eyebrow="Configuration"
        title="Store settings"
        description={`Version ${settings.version} · Changes apply to new operations only.`}
        action={
          <div className="admin-heading-actions">
            {draft ? (
              <LoadingButton type="button" variant="secondary" disabled={saving} onClick={() => setDraft(null)}>
                Discard
              </LoadingButton>
            ) : null}
            <LoadingButton type="button" loading={saving} loadingText="Saving…" disabled={!draft} onClick={() => void save()}>
              Save changes
            </LoadingButton>
          </div>
        }
      />

      <div className="admin-tabs" role="tablist" aria-label="Settings sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`settings-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls="settings-panel"
            className={tab === item.id ? "is-active" : undefined}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div id="settings-panel" role="tabpanel" aria-labelledby={`settings-tab-${tab}`}>
        {tab === "integrations" ? (
          <AdminCard
            title="Integrations"
            description={
              healthRequest.data?.checkedAt ? `Last checked ${formatDateTime(healthRequest.data.checkedAt)}` : activeTab.description
            }
            action={
              <LoadingButton type="button" variant="secondary" loading={healthRequest.loading} onClick={() => void healthRequest.refetch()}>
                Re-check
              </LoadingButton>
            }
          >
            {healthRequest.error ? <p className="admin-form-error">{healthRequest.error}</p> : null}
            <div className="admin-integration-grid">
              {(healthRequest.data?.integrations ?? []).map((row) => (
                <article key={row.id} className="admin-integration-card">
                  <div>
                    <h3>{row.label}</h3>
                    <p>{row.configured ? "Credentials configured" : "Not configured"}</p>
                    {row.lastError ? <small>{row.lastError}</small> : null}
                  </div>
                  <AdminStatusChip status={row.status} tone={row.configured ? undefined : "danger"} />
                </article>
              ))}
            </div>
            <p className="admin-card__footnote">
              <ShieldCheck size={13} aria-hidden="true" /> Payment and courier credentials are stored encrypted per store and are never shown here.
            </p>
          </AdminCard>
        ) : (
          <AdminCard title={activeTab.label} description={activeTab.description}>
            <div className="admin-form-grid">
              {FIELDS[tab].map((field) => {
                const raw = merged[tab][field.name] ?? field.fallback ?? "";
                const onChange = (value: string) =>
                  patchField(tab, field.name, field.type === "number" ? Number(value) : field.transform ? field.transform(value) : value);
                return (
                  <label key={field.name} className={`admin-field${field.wide ? " admin-field-wide" : ""}`}>
                    {field.label}
                    {field.type === "textarea" ? (
                      <textarea value={String(raw)} rows={3} onChange={(event) => onChange(event.currentTarget.value)} />
                    ) : field.type === "select" ? (
                      <select value={String(raw)} onChange={(event) => onChange(event.currentTarget.value)}>
                        {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    ) : (
                      <input
                        type={field.type ?? "text"}
                        step={field.step}
                        min={field.type === "number" ? 0 : undefined}
                        value={String(raw)}
                        onChange={(event) => onChange(event.currentTarget.value)}
                      />
                    )}
                    {field.hint ? <small className="admin-field-hint">{field.hint}</small> : null}
                  </label>
                );
              })}
            </div>
          </AdminCard>
        )}
      </div>
    </>
  );
}
