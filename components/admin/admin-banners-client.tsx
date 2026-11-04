"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type CSSProperties, type ChangeEvent, type FormEvent } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Monitor, Smartphone } from "lucide-react";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import AdminStatusChip from "@/components/admin/admin-status-chip";
import AdminCard from "@/components/admin/admin-card";
import Button from "@/components/ui/button";
import LoadingButton from "@/components/ui/buttons/loading-button";
import { DatePicker } from "@/components/ui/form/date-picker";
import ErrorCard from "@/components/ui/feedback/error-card";
import TableSkeleton from "@/components/ui/loaders/table-skeleton";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { useApiRequest } from "@/hooks/use-api-request";
import { apiRequest } from "@/lib/api/api-client";
import { sendJson } from "@/lib/api/send-json";
import { formatDateTime } from "@/lib/format";
import type { AdminBanner, BannerImage } from "@/features/banners/types";

const STATUS_TONE = { live: "active", scheduled: "pending", ended: "inactive", hidden: "draft" } as const;
const STATUS_LABEL = { live: "Live", scheduled: "Scheduled", ended: "Ended", hidden: "Hidden" } as const;

/* ------------------------------------------------------------------ list */

export function AdminBannerList() {
  const feedback = useFeedback();
  const { loading, error, data, refetch } = useApiRequest<AdminBanner[]>("/api/v1/admin/banners");
  const [busy, setBusy] = useState<string | null>(null);

  async function act(key: string, action: () => Promise<unknown>, message: string) {
    setBusy(key);
    try {
      await action();
      feedback.success(message);
      await refetch();
    } catch (cause) {
      feedback.error("Not saved", cause instanceof Error ? cause.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  const move = (index: number, direction: -1 | 1) => {
    const ids = (data ?? []).map((banner) => banner.id);
    const target = index + direction;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    return act("reorder", () => sendJson("/api/v1/admin/banners/reorder", "PUT", { ids }), "Order saved");
  };

  return (
    <>
      <AdminPageHeading
        eyebrow="Marketing"
        title="Home page banners"
        description="Slides rotate at the top of the home page in this order. Live banners update on the storefront within seconds."
        action={<Button href="/admin/banners/new">New banner</Button>}
      />
      {error ? <ErrorCard title="Unable to load banners" description={error} action={<LoadingButton onClick={() => void refetch()}>Retry</LoadingButton>} /> : null}
      {loading && !data ? (
        <TableSkeleton rows={4} />
      ) : !data?.length ? (
        <AdminCard>
          <div className="admin-empty-results" role="status">
            No banners yet. The home page shows your store headline and hero image until you add one.
          </div>
        </AdminCard>
      ) : (
        <ol className="admin-banner-list">
          {data.map((banner, index) => (
            <li key={banner.id} className="admin-banner-row">
              <div className="admin-banner-row__order">
                <button type="button" className="icon-button" aria-label={`Move ${banner.name} up`} disabled={index === 0 || busy !== null} onClick={() => void move(index, -1)}>
                  <ArrowUp size={15} />
                </button>
                <button type="button" className="icon-button" aria-label={`Move ${banner.name} down`} disabled={index === data.length - 1 || busy !== null} onClick={() => void move(index, 1)}>
                  <ArrowDown size={15} />
                </button>
              </div>
              <div className="admin-banner-row__thumb">
                <Image src={banner.image.url} alt="" fill sizes="200px" className="cover-image" />
              </div>
              <div className="admin-banner-row__copy">
                <strong>{banner.name}</strong>
                <span>{banner.title}</span>
                <small>
                  {banner.startsAt ? `From ${formatDateTime(banner.startsAt)}` : "Always"}
                  {banner.endsAt ? ` · until ${formatDateTime(banner.endsAt)}` : ""}
                </small>
              </div>
              <AdminStatusChip status={STATUS_TONE[banner.status]} label={STATUS_LABEL[banner.status]} />
              <div className="admin-product-actions">
                <Link href={`/admin/banners/${banner.id}`}>Edit</Link>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void act(banner.id, () => sendJson(`/api/v1/admin/banners/${banner.id}`, "PATCH", { isActive: !banner.isActive }), banner.isActive ? "Banner hidden" : "Banner shown")}
                >
                  {banner.isActive ? "Hide" : "Show"}
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => {
                    if (window.confirm(`Delete “${banner.name}”? Its images are removed too.`)) {
                      void act(banner.id, () => sendJson(`/api/v1/admin/banners/${banner.id}`, "DELETE"), "Banner deleted");
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ form */

type Draft = Omit<AdminBanner, "id" | "status" | "sortOrder" | "updatedAt" | "startsAt" | "endsAt" | "image"> & {
  image: BannerImage | null;
  startsAt: string;
  endsAt: string;
};

const EMPTY: Draft = {
  name: "",
  eyebrow: "",
  title: "",
  subtitle: "",
  primaryCta: { label: "Shop now", href: "/products" },
  secondaryCta: { label: "", href: "" },
  image: null,
  mobileImage: null,
  imageAlt: "",
  textPosition: "left",
  textTone: "light",
  overlayOpacity: 35,
  startsAt: "",
  endsAt: "",
  isActive: true,
};

/** The date picker works in local time without a zone ("YYYY-MM-DDTHH:mm"). */
const toLocalInput = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function toDraft(banner: AdminBanner): Draft {
  return { ...banner, startsAt: toLocalInput(banner.startsAt), endsAt: toLocalInput(banner.endsAt) };
}

/** Single image upload to Cloudinary; also used by the buying guide editor. */
export function ImageField({ label, hint, value, onChange, required, folder = "norosilk/banners", filenamePrefix = "banner" }: {
  label: string;
  hint: string;
  value: BannerImage | null;
  onChange: (image: BannerImage | null) => void;
  required?: boolean;
  folder?: string;
  filenamePrefix?: string;
}) {
  const feedback = useFeedback();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("files", file);
      form.append("folder", folder);
      form.append("filenamePrefix", filenamePrefix);
      const result = await apiRequest<{ images: { secureUrl: string; publicId: string; width: number; height: number }[] }>("/api/v1/upload", { method: "POST", body: form });
      const image = result.data?.images?.[0];
      if (!image) throw new Error("The upload did not return an image.");
      onChange({ url: image.secureUrl, publicId: image.publicId, width: image.width, height: image.height });
    } catch (cause) {
      feedback.error("Upload failed", cause instanceof Error ? cause.message : undefined);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="admin-field admin-field-wide">
      <span>{label}{required ? " *" : ""}</span>
      <div className="admin-banner-image-field">
        {value ? (
          <span className="admin-banner-image-field__preview">
            <Image src={value.url} alt="" fill sizes="240px" className="cover-image" />
          </span>
        ) : null}
        <div>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={upload} />
          <LoadingButton type="button" variant="secondary" size="sm" loading={uploading} loadingText="Uploading…" icon={<ImagePlus size={14} aria-hidden="true" />} onClick={() => inputRef.current?.click()}>
            {value ? "Replace image" : "Upload image"}
          </LoadingButton>
          {value && !required ? <button type="button" className="text-button" onClick={() => onChange(null)}>Remove</button> : null}
          <small className="admin-field-hint">{hint}</small>
        </div>
      </div>
    </div>
  );
}

/** Live preview using the storefront's own banner styles. */
function BannerPreview({ draft, device }: { draft: Draft; device: "desktop" | "mobile" }) {
  const image = device === "mobile" && draft.mobileImage ? draft.mobileImage : draft.image;
  return (
    <div className={`admin-banner-preview admin-banner-preview--${device}`}>
      <div className="hero-banner__viewport">
        <ul className="hero-banner__track">
          <li
            className="hero-banner__slide"
            data-active="true"
            data-tone={draft.textTone}
            data-position={draft.textPosition}
            style={{ "--banner-overlay": draft.overlayOpacity / 100 } as CSSProperties}
          >
            {image ? (
              <picture>
                <img src={image.url} alt="" className="hero-banner__image" />
              </picture>
            ) : null}
            <div className="hero-banner__content">
              {draft.eyebrow ? <p className="hero-banner__eyebrow">{draft.eyebrow}</p> : null}
              <p className="hero-banner__title">{draft.title || "Your headline"}</p>
              {draft.subtitle ? <p className="hero-banner__subtitle">{draft.subtitle}</p> : null}
              {draft.primaryCta.label || draft.secondaryCta.label ? (
                <div className="hero-banner__actions">
                  {draft.primaryCta.label ? <span className="hero-banner__cta hero-banner__cta--primary">{draft.primaryCta.label}</span> : null}
                  {draft.secondaryCta.label ? <span className="hero-banner__cta hero-banner__cta--secondary">{draft.secondaryCta.label}</span> : null}
                </div>
              ) : null}
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}

export function AdminBannerForm({ initial }: { initial?: AdminBanner }) {
  const router = useRouter();
  const feedback = useFeedback();
  const [draft, setDraft] = useState<Draft>(() => (initial ? toDraft(initial) : EMPTY));
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft.image) {
      setErrors({ image: "Upload a banner image." });
      return;
    }
    setSaving(true);
    setErrors({});
    const payload = {
      ...draft,
      startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : null,
      endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : null,
    };
    try {
      await sendJson(initial ? `/api/v1/admin/banners/${initial.id}` : "/api/v1/admin/banners", initial ? "PATCH" : "POST", payload);
      feedback.success(initial ? "Banner saved" : "Banner created");
      router.push("/admin/banners");
    } catch (cause) {
      const fieldErrors: Record<string, string> = {};
      const issues = (cause as { errors?: { field: string; message: string }[] }).errors ?? [];
      for (const issue of issues) fieldErrors[issue.field.split(".")[0]] ??= issue.message;
      setErrors(fieldErrors);
      feedback.error("Banner not saved", cause instanceof Error ? cause.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  const error = (field: string) => (errors[field] ? <span className="admin-form-error">{errors[field]}</span> : null);

  return (
    <form onSubmit={onSubmit} noValidate>
      <AdminPageHeading
        eyebrow="Marketing"
        title={initial ? `Edit “${initial.name}”` : "New banner"}
        action={
          <div className="admin-heading-actions">
            <Link className="button button-glass button-sm" href="/admin/banners">Cancel</Link>
            <LoadingButton type="submit" size="sm" loading={saving} loadingText="Saving…">Save banner</LoadingButton>
          </div>
        }
      />

      <AdminCard
        title="Preview"
        action={
          <div className="admin-segmented" role="group" aria-label="Preview device">
            <button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}><Monitor size={14} aria-hidden="true" /> Desktop</button>
            <button type="button" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")}><Smartphone size={14} aria-hidden="true" /> Mobile</button>
          </div>
        }
      >
        <BannerPreview draft={draft} device={device} />
      </AdminCard>

      <div className="admin-detail-grid">
        <AdminCard title="Content">
          <div className="admin-form-grid">
            <label className="admin-field admin-field-wide">Internal name<input value={draft.name} maxLength={120} placeholder="Diwali sale 2026" onChange={(event) => set("name", event.currentTarget.value)} />{error("name")}</label>
            <label className="admin-field">Eyebrow<input value={draft.eyebrow} maxLength={60} placeholder="New collection" onChange={(event) => set("eyebrow", event.currentTarget.value)} /></label>
            <label className="admin-field admin-field-wide">Headline<input value={draft.title} maxLength={120} onChange={(event) => set("title", event.currentTarget.value)} />{error("title")}</label>
            <label className="admin-field admin-field-wide">Supporting text<textarea rows={2} maxLength={280} value={draft.subtitle} onChange={(event) => set("subtitle", event.currentTarget.value)} /></label>
            <label className="admin-field">Main button<input value={draft.primaryCta.label} maxLength={40} placeholder="Shop now" onChange={(event) => set("primaryCta", { ...draft.primaryCta, label: event.currentTarget.value })} /></label>
            <label className="admin-field">Main button link<input value={draft.primaryCta.href} maxLength={2048} placeholder="/categories/banarasi-silk" onChange={(event) => set("primaryCta", { ...draft.primaryCta, href: event.currentTarget.value })} />{error("primaryCta")}</label>
            <label className="admin-field">Second button<input value={draft.secondaryCta.label} maxLength={40} placeholder="Request a quote" onChange={(event) => set("secondaryCta", { ...draft.secondaryCta, label: event.currentTarget.value })} /></label>
            <label className="admin-field">Second button link<input value={draft.secondaryCta.href} maxLength={2048} placeholder="/request-quote" onChange={(event) => set("secondaryCta", { ...draft.secondaryCta, href: event.currentTarget.value })} />{error("secondaryCta")}</label>
          </div>
        </AdminCard>

        <AdminCard title="Images & style">
          <div className="admin-form-grid">
            <ImageField label="Desktop image" required hint="Wide image, at least 1920 × 800 px. Keep the subject away from the text side." value={draft.image} onChange={(image) => set("image", image)} />
            {error("image")}
            <ImageField label="Mobile image" hint="Optional crop for phones, about 1200 × 750 px. Uses the desktop image when empty." value={draft.mobileImage} onChange={(image) => set("mobileImage", image)} />
            <label className="admin-field admin-field-wide">Image description (for screen readers)<input value={draft.imageAlt} maxLength={160} placeholder="Model in a red Banarasi silk saree" onChange={(event) => set("imageAlt", event.currentTarget.value)} /></label>
            <label className="admin-field">
              Text position
              <select value={draft.textPosition} onChange={(event) => set("textPosition", event.currentTarget.value as Draft["textPosition"])}>
                <option value="left">Left</option>
                <option value="center">Centre</option>
                <option value="right">Right</option>
              </select>
            </label>
            <label className="admin-field">
              Text colour
              <select value={draft.textTone} onChange={(event) => set("textTone", event.currentTarget.value as Draft["textTone"])}>
                <option value="light">Light text (dark images)</option>
                <option value="dark">Dark text (light images)</option>
              </select>
            </label>
            <label className="admin-field admin-field-wide">
              Image shading: {draft.overlayOpacity}%
              <input type="range" min={0} max={80} step={5} value={draft.overlayOpacity} onChange={(event) => set("overlayOpacity", Number(event.currentTarget.value))} />
            </label>
          </div>
        </AdminCard>
      </div>

      <AdminCard title="Schedule">
        <div className="admin-form-grid">
          <label className="admin-checkbox"><input type="checkbox" checked={draft.isActive} onChange={(event) => set("isActive", event.currentTarget.checked)} /> Show on the home page</label>
          <DatePicker className="admin-field" label="Start (optional)" withTime value={draft.startsAt} onChange={(startsAt) => set("startsAt", startsAt)} />
          <DatePicker className="admin-field" label="End (optional)" withTime min={draft.startsAt} value={draft.endsAt} onChange={(endsAt) => set("endsAt", endsAt)} error={errors.endsAt} />
        </div>
      </AdminCard>
    </form>
  );
}

export function AdminBannerEdit({ bannerId }: { bannerId: string }) {
  const { loading, error, data } = useApiRequest<AdminBanner>(`/api/v1/admin/banners/${encodeURIComponent(bannerId)}`);
  if (loading && !data) return <TableSkeleton rows={6} />;
  if (error || !data) return <ErrorCard title="Banner unavailable" description={error || "Not found."} action={<Button href="/admin/banners">Back to banners</Button>} />;
  return <AdminBannerForm key={data.updatedAt} initial={data} />;
}
