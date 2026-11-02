"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import AdminStatusChip from "@/components/admin/admin-status-chip";
import AdminCard from "@/components/admin/admin-card";
import LoadingButton from "@/components/ui/buttons/loading-button";
import ErrorCard from "@/components/ui/feedback/error-card";
import TableSkeleton from "@/components/ui/loaders/table-skeleton";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { useApiRequest } from "@/hooks/use-api-request";
import { sendJson } from "@/lib/api/send-json";
import { formatDate, formatDateTime } from "@/lib/format";
import type { StorePageContent } from "@/lib/content/types";

type Staff = { id: string; name: string; email: string; adminRole: string; isActive: boolean; lastLoginAt: string | null };

const ROLE_HELP: Record<string, string> = {
  owner: "Everything, including store settings and staff",
  manager: "Catalogue, orders, customers, payments and refunds",
  staff: "Orders, quotes, support, reviews and returns",
};

export function AdminStaff() {
  const feedback = useFeedback();
  const { loading, error, data, refetch } = useApiRequest<Staff[]>("/api/v1/admin/staff");
  const [busy, setBusy] = useState<string | null>(null);

  async function act(key: string, action: () => Promise<unknown>, message: string) {
    setBusy(key);
    try {
      await action();
      feedback.success(message);
      await refetch();
      return true;
    } catch (cause) {
      feedback.error("Not saved", cause instanceof Error ? cause.message : undefined);
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const target = event.currentTarget;
    const created = await act(
      "create",
      () => sendJson("/api/v1/admin/staff", "POST", {
        name: String(form.get("name") ?? "").trim(),
        email: String(form.get("email") ?? "").trim(),
        adminRole: String(form.get("adminRole")),
        password: String(form.get("password") ?? ""),
      }),
      "Staff account created. Share the password privately.",
    );
    if (created) target.reset();
  }

  return (
    <>
      <AdminPageHeading eyebrow="Team" title="Staff & roles" description="Who can sign in to this store's admin, and what they can do. Changing a role signs that person out." />
      {error ? <ErrorCard title="Unable to load staff" description={error} /> : null}
      <div className="admin-detail-grid">
        <AdminCard title="Team">
          {loading && !data ? <TableSkeleton rows={4} /> : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th scope="col">Person</th><th scope="col">Role</th><th scope="col">Last sign-in</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
                <tbody>
                  {(data ?? []).map((member) => (
                    <tr key={member.id}>
                      <td><strong>{member.name}</strong><small className="admin-cell-sub">{member.email}</small></td>
                      <td>
                        <select
                          aria-label={`Role for ${member.name}`}
                          value={member.adminRole}
                          disabled={busy === member.id}
                          onChange={(event) => void act(member.id, () => sendJson(`/api/v1/admin/staff/${member.id}`, "PATCH", { adminRole: event.currentTarget.value }), "Role updated")}
                        >
                          <option value="owner">Owner</option>
                          <option value="manager">Manager</option>
                          <option value="staff">Staff</option>
                        </select>
                      </td>
                      <td>{member.lastLoginAt ? formatDateTime(member.lastLoginAt) : "Never"}</td>
                      <td><AdminStatusChip status={member.isActive ? "active" : "inactive"} /></td>
                      <td>
                        <button
                          type="button"
                          className="text-button"
                          disabled={busy === member.id}
                          onClick={() => void act(member.id, () => sendJson(`/api/v1/admin/staff/${member.id}`, "PATCH", { isActive: !member.isActive }), member.isActive ? "Access removed" : "Access restored")}
                        >
                          {member.isActive ? "Remove access" : "Restore access"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <ul className="admin-role-help">
            {Object.entries(ROLE_HELP).map(([role, help]) => <li key={role}><strong>{role}</strong>: {help}</li>)}
          </ul>
        </AdminCard>
        <AdminCard title="Add a team member">
          <form className="admin-form-grid" onSubmit={create}>
            <label className="admin-field admin-field-wide">Name<input name="name" required minLength={2} maxLength={120} /></label>
            <label className="admin-field admin-field-wide">Email<input name="email" type="email" required maxLength={254} /></label>
            <label className="admin-field">
              Role
              <select name="adminRole" defaultValue="staff">
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
                <option value="owner">Owner</option>
              </select>
            </label>
            <label className="admin-field">Initial password<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
            <div className="admin-form-actions">
              <LoadingButton type="submit" size="sm" loading={busy === "create"}>Create account</LoadingButton>
            </div>
          </form>
        </AdminCard>
      </div>
    </>
  );
}

type PageSummary = { slug: string; title: string; isDefault: boolean; updatedAt: string | null };

export function AdminContentList() {
  const { loading, error, data } = useApiRequest<PageSummary[]>("/api/v1/admin/pages");
  return (
    <>
      <AdminPageHeading eyebrow="Content" title="Pages" description="About, FAQ and policy pages. Each starts from a template using your store's details; review policies with your adviser." />
      {error ? <ErrorCard title="Unable to load pages" description={error} /> : null}
      {loading && !data ? <TableSkeleton rows={6} /> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th scope="col">Page</th><th scope="col">URL</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
            <tbody>
              {(data ?? []).map((page) => (
                <tr key={page.slug}>
                  <td><strong>{page.title}</strong></td>
                  <td><code>/{page.slug}</code></td>
                  <td>{page.isDefault ? <AdminStatusChip status="draft" label="Default template" /> : <AdminStatusChip status="active" label={`Edited ${page.updatedAt ? formatDate(page.updatedAt) : ""}`} />}</td>
                  <td><div className="admin-product-actions"><Link href={`/admin/content/${page.slug}`}>Edit</Link><Link href={`/${page.slug}`} target="_blank">View</Link></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function AdminPageEditor({ slug }: { slug: string }) {
  const feedback = useFeedback();
  const endpoint = `/api/v1/admin/pages/${slug}`;
  const { loading, error, data, refetch } = useApiRequest<StorePageContent>(endpoint);
  const [draft, setDraft] = useState<StorePageContent | null>(null);
  const [busy, setBusy] = useState<"save" | "reset" | null>(null);
  const page = draft ?? data;

  if (loading && !data) return <TableSkeleton rows={6} />;
  if (error || !page) return <ErrorCard title="Page unavailable" description={error || "Not found."} />;

  const change = (changes: Partial<StorePageContent>) => setDraft({ ...page, ...changes });

  async function persist(kind: "save" | "reset") {
    setBusy(kind);
    try {
      if (kind === "save") {
        await sendJson(endpoint, "PUT", { title: page!.title, summary: page!.summary, sections: page!.sections, faqs: page!.faqs });
      } else {
        await sendJson(endpoint, "DELETE");
      }
      feedback.success(kind === "save" ? "Page published" : "Restored the default template");
      setDraft(null);
      await refetch();
    } catch (cause) {
      feedback.error("Page not saved", cause instanceof Error ? cause.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <AdminPageHeading
        eyebrow="Content"
        title={`Edit ${page.title}`}
        description={page.isDefault ? "Showing the default template. Publishing saves your own version." : `Last published ${page.updatedAt ? formatDateTime(page.updatedAt) : ""}`}
        action={
          <div className="admin-heading-actions">
            <Link className="button button-glass button-sm" href="/admin/content">All pages</Link>
            {!page.isDefault ? <LoadingButton type="button" variant="secondary" size="sm" loading={busy === "reset"} onClick={() => void persist("reset")}>Restore default</LoadingButton> : null}
            <LoadingButton type="button" size="sm" loading={busy === "save"} onClick={() => void persist("save")}>Publish</LoadingButton>
          </div>
        }
      />
      <AdminCard>
        <div className="admin-form-grid">
          <label className="admin-field admin-field-wide">Title<input value={page.title} maxLength={160} onChange={(event) => change({ title: event.currentTarget.value })} /></label>
          <label className="admin-field admin-field-wide">Summary<textarea rows={2} maxLength={400} value={page.summary} onChange={(event) => change({ summary: event.currentTarget.value })} /></label>
        </div>
        <p className="admin-image-disclaimer">Text only: separate paragraphs with a blank line.</p>
        {page.sections.map((section, index) => (
          <fieldset key={index} className="admin-repeater">
            <legend>Section {index + 1}</legend>
            <label className="admin-field">Heading<input value={section.heading} maxLength={160} onChange={(event) => change({ sections: page.sections.map((entry, at) => (at === index ? { ...entry, heading: event.currentTarget.value } : entry)) })} /></label>
            <label className="admin-field">Text<textarea rows={4} maxLength={8000} value={section.body} onChange={(event) => change({ sections: page.sections.map((entry, at) => (at === index ? { ...entry, body: event.currentTarget.value } : entry)) })} /></label>
            <button type="button" className="text-button" onClick={() => change({ sections: page.sections.filter((_, at) => at !== index) })}><Trash2 size={14} aria-hidden="true" /> Remove section</button>
          </fieldset>
        ))}
        <button type="button" className="text-button" onClick={() => change({ sections: [...page.sections, { heading: "", body: "" }] })}><Plus size={14} aria-hidden="true" /> Add section</button>
        {slug === "faq" || page.faqs.length > 0 ? (
          <>
            {page.faqs.map((faq, index) => (
              <fieldset key={index} className="admin-repeater">
                <legend>Question {index + 1}</legend>
                <label className="admin-field">Question<input value={faq.question} maxLength={300} onChange={(event) => change({ faqs: page.faqs.map((entry, at) => (at === index ? { ...entry, question: event.currentTarget.value } : entry)) })} /></label>
                <label className="admin-field">Answer<textarea rows={3} maxLength={4000} value={faq.answer} onChange={(event) => change({ faqs: page.faqs.map((entry, at) => (at === index ? { ...entry, answer: event.currentTarget.value } : entry)) })} /></label>
                <button type="button" className="text-button" onClick={() => change({ faqs: page.faqs.filter((_, at) => at !== index) })}><Trash2 size={14} aria-hidden="true" /> Remove question</button>
              </fieldset>
            ))}
            <button type="button" className="text-button" onClick={() => change({ faqs: [...page.faqs, { question: "", answer: "" }] })}><Plus size={14} aria-hidden="true" /> Add question</button>
          </>
        ) : null}
      </AdminCard>
    </>
  );
}
