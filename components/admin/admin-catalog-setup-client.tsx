"use client";

import { useState, type FormEvent } from "react";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import AdminStatusChip from "@/components/admin/admin-status-chip";
import AdminCard from "@/components/admin/admin-card";
import LoadingButton from "@/components/ui/buttons/loading-button";
import Combobox from "@/components/ui/form/combobox";
import ErrorCard from "@/components/ui/feedback/error-card";
import TableSkeleton from "@/components/ui/loaders/table-skeleton";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { useApiRequest } from "@/hooks/use-api-request";
import { sendJson } from "@/lib/api/send-json";

type Category = { _id: string; name: string; slug: string; description?: string; image?: { url?: string }; parentCategory?: string | null; isActive: boolean; sortOrder: number };

function useSave() {
  const feedback = useFeedback();
  const [busy, setBusy] = useState<string | null>(null);
  async function run(key: string, action: () => Promise<unknown>, success: string) {
    setBusy(key);
    try {
      await action();
      feedback.success(success);
      return true;
    } catch (cause) {
      feedback.error("Not saved", cause instanceof Error ? cause.message : undefined);
      return false;
    } finally {
      setBusy(null);
    }
  }
  return { busy, run };
}

export function AdminCategories() {
  const { loading, error, data, refetch } = useApiRequest<Category[]>("/api/v1/categories?includeInactive=true");
  const { busy, run } = useSave();
  const [editing, setEditing] = useState<Category | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") ?? "").trim(),
      description: String(form.get("description") ?? "").trim(),
      image: form.get("imageUrl") ? { url: String(form.get("imageUrl")).trim() } : undefined,
      parentCategory: String(form.get("parentCategory") ?? "") || null,
      sortOrder: Number(form.get("sortOrder")) || 0,
      isActive: form.get("isActive") === "on",
    };
    const target = event.currentTarget;
    const saved = await run(
      "save",
      () => (editing ? sendJson(`/api/v1/categories/${editing._id}`, "PATCH", payload) : sendJson("/api/v1/categories", "POST", payload)),
      editing ? "Category updated" : "Category created",
    );
    if (saved) {
      setEditing(null);
      target.reset();
      await refetch();
    }
  }

  return (
    <>
      <AdminPageHeading eyebrow="Catalogue" title="Categories" description="Organise products into collections. Parent categories list their children's products." />
      {error ? <ErrorCard title="Unable to load categories" description={error} /> : null}
      <div className="admin-detail-grid">
        <AdminCard title="All categories">
          {loading && !data ? <TableSkeleton rows={5} /> : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th scope="col">Name</th><th scope="col">Parent</th><th scope="col" className="is-numeric">Order</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
                <tbody>
                  {(data ?? []).map((category) => (
                    <tr key={category._id}>
                      <td><strong>{category.name}</strong><small className="admin-cell-sub">/{category.slug}</small></td>
                      <td>{data?.find((entry) => entry._id === category.parentCategory)?.name ?? "—"}</td>
                      <td className="is-numeric">{category.sortOrder}</td>
                      <td><AdminStatusChip status={category.isActive ? "active" : "inactive"} /></td>
                      <td><button type="button" className="text-button" onClick={() => setEditing(category)}>Edit</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminCard>
        <AdminCard title={editing ? `Edit ${editing.name}` : "New category"}>
          <form key={editing?._id ?? "new"} className="admin-form-grid" onSubmit={onSubmit}>
            <label className="admin-field admin-field-wide">Name<input name="name" required minLength={2} maxLength={120} defaultValue={editing?.name} /></label>
            <label className="admin-field admin-field-wide">Description<textarea name="description" rows={3} maxLength={2000} defaultValue={editing?.description} /></label>
            <label className="admin-field admin-field-wide">Image URL<input name="imageUrl" type="url" defaultValue={editing?.image?.url} /></label>
            <Combobox
              className="admin-field"
              label="Parent"
              name="parentCategory"
              placeholder="None"
              options={(data ?? []).filter((category) => category._id !== editing?._id).map((category) => ({ id: category._id, label: category.name }))}
              defaultValue={editing?.parentCategory ?? ""}
            />
            <label className="admin-field">Display order<input name="sortOrder" type="number" min={0} max={10000} defaultValue={editing?.sortOrder ?? 0} /></label>
            <label className="admin-checkbox"><input name="isActive" type="checkbox" defaultChecked={editing?.isActive ?? true} /> Visible on the storefront</label>
            <div className="admin-form-actions">
              {editing ? <button type="button" className="text-button" onClick={() => setEditing(null)}>Cancel</button> : null}
              <LoadingButton type="submit" size="sm" loading={busy === "save"}>{editing ? "Save category" : "Add category"}</LoadingButton>
            </div>
          </form>
        </AdminCard>
      </div>
    </>
  );
}
