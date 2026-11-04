"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import AdminStatusChip from "@/components/admin/admin-status-chip";
import AdminCard from "@/components/admin/admin-card";
import { ImageField } from "@/components/admin/admin-banners-client";
import Button from "@/components/ui/button";
import LoadingButton from "@/components/ui/buttons/loading-button";
import ErrorCard from "@/components/ui/feedback/error-card";
import TableSkeleton from "@/components/ui/loaders/table-skeleton";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { useApiRequest } from "@/hooks/use-api-request";
import { sendJson } from "@/lib/api/send-json";
import { formatDateTime } from "@/lib/format";
import type { AdminGuide, GuideSection } from "@/features/guides/types";

/* ------------------------------------------------------------------ list */

export function AdminGuideList() {
  const feedback = useFeedback();
  const { loading, error, data, refetch } = useApiRequest<AdminGuide[]>("/api/v1/admin/guides");
  const [busy, setBusy] = useState<string | null>(null);

  async function remove(guide: AdminGuide) {
    if (!window.confirm(`Delete “${guide.title}”? Its cover image is removed too.`)) return;
    setBusy(guide.id);
    try {
      await sendJson(`/api/v1/admin/guides/${guide.id}`, "DELETE");
      feedback.success("Guide deleted");
      await refetch();
    } catch (cause) {
      feedback.error("Not deleted", cause instanceof Error ? cause.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <AdminPageHeading
        eyebrow="Marketing"
        title="Buying guides"
        description="Fabric, weave, care and wholesale buying guides. Published guides appear at /guides, in the sitemap and, with a cover photo, on the home page."
        action={<Button href="/admin/guides/new">New guide</Button>}
      />
      {error ? <ErrorCard title="Unable to load guides" description={error} action={<LoadingButton onClick={() => void refetch()}>Retry</LoadingButton>} /> : null}
      {loading && !data ? (
        <TableSkeleton rows={4} />
      ) : !data?.length ? (
        <AdminCard>
          <div className="admin-empty-results" role="status">No guides yet. Write your first one to help buyers choose.</div>
        </AdminCard>
      ) : (
        <AdminCard>
          <div className="admin-table-wrap is-flush">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">Status</th>
                  <th scope="col">Updated</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {data.map((guide) => (
                  <tr key={guide.id}>
                    <td>
                      <strong>{guide.title}</strong>
                      <br />
                      <small>/guides/{guide.slug} · {guide.readingMinutes} min read{guide.coverImage ? "" : " · no cover photo"}</small>
                    </td>
                    <td><AdminStatusChip status={guide.status === "published" ? "active" : "draft"} label={guide.status === "published" ? "Published" : "Draft"} /></td>
                    <td>{formatDateTime(guide.updatedAt)}</td>
                    <td>
                      <div className="admin-product-actions">
                        <Link href={`/admin/guides/${guide.id}`}>Edit</Link>
                        {guide.status === "published" ? <Link href={`/guides/${guide.slug}`} target="_blank">View</Link> : null}
                        <button type="button" disabled={busy !== null} onClick={() => void remove(guide)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ form */

type Draft = Pick<AdminGuide, "title" | "slug" | "excerpt" | "coverImage" | "coverAlt" | "sections" | "status">;

const EMPTY: Draft = { title: "", slug: "", excerpt: "", coverImage: null, coverAlt: "", sections: [{ heading: "", body: "" }], status: "draft" };

export function AdminGuideForm({ initial }: { initial?: AdminGuide }) {
  const router = useRouter();
  const feedback = useFeedback();
  const [draft, setDraft] = useState<Draft>(() =>
    initial
      ? { title: initial.title, slug: initial.slug, excerpt: initial.excerpt, coverImage: initial.coverImage, coverAlt: initial.coverAlt, sections: initial.sections.length ? initial.sections : EMPTY.sections, status: initial.status }
      : EMPTY,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const setSection = (index: number, patch: Partial<GuideSection>) =>
    set("sections", draft.sections.map((section, position) => (position === index ? { ...section, ...patch } : section)));
  const moveSection = (index: number, direction: -1 | 1) => {
    const sections = [...draft.sections];
    [sections[index], sections[index + direction]] = [sections[index + direction], sections[index]];
    set("sections", sections);
  };

  async function save(status: Draft["status"]) {
    setSaving(true);
    setErrors({});
    const payload = {
      ...draft,
      status,
      slug: draft.slug.trim() || undefined,
      // Empty trailing sections are drafts in progress, not content.
      sections: draft.sections.filter((section) => section.heading.trim() || section.body.trim()),
    };
    try {
      await sendJson(initial ? `/api/v1/admin/guides/${initial.id}` : "/api/v1/admin/guides", initial ? "PATCH" : "POST", payload);
      feedback.success(status === "published" ? "Guide published" : "Draft saved");
      router.push("/admin/guides");
    } catch (cause) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of (cause as { errors?: { field: string; message: string }[] }).errors ?? []) fieldErrors[issue.field.split(".")[0]] ??= issue.message;
      setErrors(fieldErrors);
      feedback.error("Guide not saved", cause instanceof Error ? cause.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void save(draft.status);
  };
  const error = (field: string) => (errors[field] ? <span className="admin-form-error">{errors[field]}</span> : null);

  return (
    <form onSubmit={onSubmit} noValidate>
      <AdminPageHeading
        eyebrow="Buying guides"
        title={initial ? "Edit guide" : "New guide"}
        action={
          <div className="admin-heading-actions">
            <Link className="button button-glass button-sm" href="/admin/guides">Cancel</Link>
            <LoadingButton type="button" variant="secondary" loading={saving} onClick={() => void save("draft")}>
              {initial?.status === "published" ? "Unpublish" : "Save draft"}
            </LoadingButton>
            <LoadingButton type="button" loading={saving} onClick={() => void save("published")}>
              {initial?.status === "published" ? "Save" : "Publish"}
            </LoadingButton>
          </div>
        }
      />
      <div className="admin-detail-grid">
        <AdminCard title="Summary">
          <div className="admin-form-grid">
            <label className="admin-field admin-field-wide">Title<input value={draft.title} maxLength={160} placeholder="How to tell pure silk from blends" onChange={(event) => set("title", event.currentTarget.value)} />{error("title")}</label>
            <label className="admin-field admin-field-wide">
              Web address
              <input value={draft.slug} maxLength={90} placeholder="Leave empty to create one from the title" onChange={(event) => set("slug", event.currentTarget.value.toLowerCase())} />
              <small className="admin-field-hint">/guides/{draft.slug || "…"}</small>
              {error("slug")}
            </label>
            <label className="admin-field admin-field-wide">Short summary<textarea rows={2} maxLength={300} value={draft.excerpt} onChange={(event) => set("excerpt", event.currentTarget.value)} /></label>
          </div>
        </AdminCard>
        <AdminCard title="Cover photo">
          <div className="admin-form-grid">
            <ImageField
              label="Cover image"
              hint="Landscape, at least 1600 × 900. Needed for the guide to show on the home page."
              value={draft.coverImage}
              folder="norosilk/blog"
              filenamePrefix="guide"
              onChange={(image) => set("coverImage", image ? { ...image, publicId: image.publicId ?? "" } : null)}
            />
            <label className="admin-field admin-field-wide">Image description (for screen readers)<input value={draft.coverAlt} maxLength={160} onChange={(event) => set("coverAlt", event.currentTarget.value)} /></label>
          </div>
        </AdminCard>
      </div>
      <AdminCard title="Sections" description="Plain text. Leave a blank line between paragraphs.">
        <div className="admin-stack">
          {draft.sections.map((section, index) => (
            <fieldset key={index} className="admin-guide-section">
              <legend className="sr-only">Section {index + 1}</legend>
              <div className="admin-guide-section__tools">
                <button type="button" className="icon-button" aria-label={`Move section ${index + 1} up`} disabled={index === 0} onClick={() => moveSection(index, -1)}><ArrowUp size={14} /></button>
                <button type="button" className="icon-button" aria-label={`Move section ${index + 1} down`} disabled={index === draft.sections.length - 1} onClick={() => moveSection(index, 1)}><ArrowDown size={14} /></button>
                <button type="button" className="icon-button" aria-label={`Remove section ${index + 1}`} disabled={draft.sections.length === 1} onClick={() => set("sections", draft.sections.filter((_, position) => position !== index))}><X size={14} /></button>
              </div>
              <label className="admin-field">Heading<input value={section.heading} maxLength={160} onChange={(event) => setSection(index, { heading: event.currentTarget.value })} /></label>
              <label className="admin-field">Text<textarea rows={8} maxLength={8000} value={section.body} onChange={(event) => setSection(index, { body: event.currentTarget.value })} /></label>
            </fieldset>
          ))}
          {error("sections")}
          {draft.sections.length < 30 ? (
            <button type="button" className="button button-glass button-sm" onClick={() => set("sections", [...draft.sections, { heading: "", body: "" }])}>
              <Plus size={14} aria-hidden="true" /> Add section
            </button>
          ) : null}
        </div>
      </AdminCard>
    </form>
  );
}

export function AdminGuideEdit({ guideId }: { guideId: string }) {
  const { loading, error, data } = useApiRequest<AdminGuide>(`/api/v1/admin/guides/${encodeURIComponent(guideId)}`);
  if (loading && !data) return <TableSkeleton rows={6} />;
  if (error || !data) return <ErrorCard title="Guide unavailable" description={error || "Not found."} action={<Button href="/admin/guides">Back to guides</Button>} />;
  return <AdminGuideForm key={data.updatedAt} initial={data} />;
}
