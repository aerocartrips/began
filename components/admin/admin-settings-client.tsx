"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import LoadingButton from "@/components/ui/buttons/LoadingButton";
import ErrorCard from "@/components/ui/feedback/ErrorCard";
import TableSkeleton from "@/components/ui/loaders/TableSkeleton";
import { useApiRequest } from "@/hooks/useApiRequest";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { apiRequest } from "@/lib/api/api-client";

type SettingsDoc = {
  general: Record<string, string>;
  business: Record<string, string | number>;
  orders: Record<string, number>;
  shipping: Record<string, string | number>;
  version: number;
};

type HealthResponse = {
  checkedAt: string;
  integrations: {
    id: string;
    label: string;
    configured: boolean;
    status: string;
    lastError?: string;
  }[];
};

export default function AdminSettingsClient() {
  const feedback = useFeedback();
  const settingsRequest = useApiRequest<SettingsDoc>("/api/v1/admin/settings");
  const healthRequest = useApiRequest<HealthResponse>("/api/v1/admin/settings/health");
  const [tab, setTab] = useState<"general" | "business" | "orders" | "shipping" | "integrations">("general");
  const [draft, setDraft] = useState<Partial<SettingsDoc> | null>(null);

  const settings = settingsRequest.data;
  const merged = useMemo(() => {
    if (!settings) return null;
    return {
      general: { ...settings.general, ...draft?.general },
      business: { ...settings.business, ...draft?.business },
      orders: { ...settings.orders, ...draft?.orders },
      shipping: { ...settings.shipping, ...draft?.shipping },
    };
  }, [settings, draft]);

  const { run: save, loading: saving } = useAsyncAction(async () => {
    if (!draft) return null;
    await apiRequest("/api/v1/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    feedback.success("Settings saved", "Store configuration updated.");
    setDraft(null);
    await settingsRequest.refetch();
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

  function patchSection(section: keyof SettingsDoc, field: string, value: string | number) {
    setDraft((current) => ({
      ...current,
      [section]: { ...(current?.[section] as Record<string, string | number>), [field]: value },
    }));
  }

  return (
    <div className="admin-page">
      <AdminPageHeading
        eyebrow="Configuration"
        title="Store settings"
        description={`Version ${settings.version}. Changes apply to new operations only.`}
        action={
          <LoadingButton type="button" loading={saving} disabled={!draft} onClick={() => void save()}>
            Save changes
          </LoadingButton>
        }
      />

      <div className="admin-product-filters">
        {(["general", "business", "orders", "shipping", "integrations"] as const).map((key) => (
          <LoadingButton
            key={key}
            type="button"
            variant={tab === key ? "primary" : "secondary"}
            onClick={() => setTab(key)}
          >
            {key}
          </LoadingButton>
        ))}
      </div>

      {tab === "general" ? (
        <section className="admin-order-status-form">
          <label>Store name<input value={merged.general.storeName ?? ""} onChange={(e) => patchSection("general", "storeName", e.target.value)} /></label>
          <label>Support email<input value={merged.general.supportEmail ?? ""} onChange={(e) => patchSection("general", "supportEmail", e.target.value)} /></label>
          <label>Support phone<input value={merged.general.supportPhone ?? ""} onChange={(e) => patchSection("general", "supportPhone", e.target.value)} /></label>
          <label>Business address<textarea value={merged.general.businessAddress ?? ""} onChange={(e) => patchSection("general", "businessAddress", e.target.value)} rows={3} /></label>
          <label>Currency<input value={merged.general.defaultCurrency ?? "INR"} onChange={(e) => patchSection("general", "defaultCurrency", e.target.value.toUpperCase())} /></label>
          <label>Time zone<input value={merged.general.timeZone ?? ""} onChange={(e) => patchSection("general", "timeZone", e.target.value)} /></label>
        </section>
      ) : null}

      {tab === "business" ? (
        <section className="admin-order-status-form">
          <label>Legal name<input value={String(merged.business.legalName ?? "")} onChange={(e) => patchSection("business", "legalName", e.target.value)} /></label>
          <label>GSTIN<input value={String(merged.business.gstin ?? "")} onChange={(e) => patchSection("business", "gstin", e.target.value.toUpperCase())} /></label>
          <label>Registered address<textarea value={String(merged.business.registeredAddress ?? "")} onChange={(e) => patchSection("business", "registeredAddress", e.target.value)} rows={3} /></label>
          <label>Invoice prefix<input value={String(merged.business.invoicePrefix ?? "INV")} onChange={(e) => patchSection("business", "invoicePrefix", e.target.value)} /></label>
        </section>
      ) : null}

      {tab === "orders" ? (
        <section className="admin-order-status-form">
          <label>Payment reservation (minutes)<input type="number" value={merged.orders.paymentReservationMinutes ?? 30} onChange={(e) => patchSection("orders", "paymentReservationMinutes", Number(e.target.value))} /></label>
          <label>Cancellation window (hours)<input type="number" value={merged.orders.cancellationWindowHours ?? 48} onChange={(e) => patchSection("orders", "cancellationWindowHours", Number(e.target.value))} /></label>
          <label>Return window (days)<input type="number" value={merged.orders.returnWindowDays ?? 7} onChange={(e) => patchSection("orders", "returnWindowDays", Number(e.target.value))} /></label>
        </section>
      ) : null}

      {tab === "shipping" ? (
        <section className="admin-order-status-form">
          <label>Pickup location<input value={String(merged.shipping.pickupLocationName ?? "")} onChange={(e) => patchSection("shipping", "pickupLocationName", e.target.value)} /></label>
          <label>Pickup pincode<input value={String(merged.shipping.pickupPincode ?? "")} onChange={(e) => patchSection("shipping", "pickupPincode", e.target.value)} /></label>
          <label>Default weight (kg)<input type="number" step="0.1" value={merged.shipping.defaultWeightKg ?? 1} onChange={(e) => patchSection("shipping", "defaultWeightKg", Number(e.target.value))} /></label>
          <label>Default box count<input type="number" value={merged.shipping.defaultBoxCount ?? 1} onChange={(e) => patchSection("shipping", "defaultBoxCount", Number(e.target.value))} /></label>
          <label>Freight mode<input value={String(merged.shipping.freightMode ?? "prepaid")} onChange={(e) => patchSection("shipping", "freightMode", e.target.value)} /></label>
        </section>
      ) : null}

      {tab === "integrations" ? (
        <section className="admin-integration-grid">
          {(healthRequest.data?.integrations ?? []).map((row) => (
            <article key={row.id} className="admin-card">
              <h3>{row.label}</h3>
              <p>{row.configured ? "Configured" : "Not configured"}</p>
              <span className={`admin-status-chip ${row.status === "ok" || row.status === "configured" ? "" : "is-draft"}`}>
                {row.status}
              </span>
              {row.lastError ? <small>{row.lastError}</small> : null}
            </article>
          ))}
          <p className="admin-storage-note">Secrets stay in deployment environment variables only.</p>
        </section>
      ) : null}
    </div>
  );
}
