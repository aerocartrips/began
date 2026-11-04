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
import { ATTRIBUTE_TYPE_LABELS, ATTRIBUTE_TYPE_VALUES } from "@/lib/constants/catalog";

type Category = { _id: string; name: string; slug: string; description?: string; image?: { url?: string }; parentCategory?: string | null; isActive: boolean; sortOrder: number };
type Attribute = { _id: string; type: string; label: string; hex?: string; sortOrder: number; isActive: boolean };

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

export function AdminAttributes() {
  const { loading, error, data, refetch } = useApiRequest<Attribute[]>("/api/v1/admin/attributes");
  const { busy, run } = useSave();
  const [type, setType] = useState<string>(ATTRIBUTE_TYPE_VALUES[0]);
  const values = (data ?? []).filter((attribute) => attribute.type === type);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const target = event.currentTarget;
    const saved = await run(
      "add",
      () => sendJson("/api/v1/admin/attributes", "POST", {
        type,
        label: String(form.get("label") ?? "").trim(),
        hex: type === "color" ? String(form.get("hex") ?? "") : "",
        sortOrder: values.length,
      }),
      "Value added",
    );
    if (saved) {
      target.reset();
      await refetch();
    }
  }

  async function update(attribute: Attribute, changes: Partial<Attribute>, message: string) {
    if (await run(attribute._id, () => sendJson(`/api/v1/admin/attributes/${attribute._id}`, "PATCH", changes), message)) await refetch();
  }
  async function remove(attribute: Attribute) {
    if (await run(attribute._id, () => sendJson(`/api/v1/admin/attributes/${attribute._id}`, "DELETE"), "Value deleted")) await refetch();
  }

  return (
    <>
      <AdminPageHeading
        eyebrow="Catalogue"
        title="Attributes"
        description="The allowed values for product details. Storefront filters use exactly these, so they stay clean. Renaming a value updates every product using it."
      />
      {error ? <ErrorCard title="Unable to load attributes" description={error} /> : null}
      <div className="admin-tabs" role="tablist" aria-label="Attribute types">
        {ATTRIBUTE_TYPE_VALUES.map((value) => (
          <button key={value} type="button" role="tab" aria-selected={type === value} className={type === value ? "is-active" : undefined} onClick={() => setType(value)}>
            {ATTRIBUTE_TYPE_LABELS[value as keyof typeof ATTRIBUTE_TYPE_LABELS]}
          </button>
        ))}
      </div>
      <AdminCard title={ATTRIBUTE_TYPE_LABELS[type as keyof typeof ATTRIBUTE_TYPE_LABELS]}>
        <form className="admin-repeater__row" onSubmit={add}>
          <label className="admin-field">New value<input name="label" required maxLength={80} /></label>
          {type === "color" ? <label className="admin-field">Swatch<input name="hex" type="color" defaultValue="#999999" /></label> : null}
          <LoadingButton type="submit" size="sm" loading={busy === "add"}>Add</LoadingButton>
        </form>
        {loading && !data ? <TableSkeleton rows={4} /> : values.length === 0 ? (
          <p className="admin-image-disclaimer">No values yet. Until you add some, products accept free text for this attribute.</p>
        ) : (
          <ul className="admin-attribute-list">
            {values.map((attribute) => (
              <li key={attribute._id}>
                {type === "color" ? (
                  <input type="color" aria-label={`Swatch for ${attribute.label}`} defaultValue={attribute.hex || "#999999"} onBlur={(event) => event.currentTarget.value !== attribute.hex && update(attribute, { hex: event.currentTarget.value }, "Swatch updated")} />
                ) : null}
                <input
                  className="admin-inline-input"
                  aria-label="Value"
                  defaultValue={attribute.label}
                  maxLength={80}
                  onBlur={(event) => {
                    const next = event.currentTarget.value.trim();
                    if (next && next !== attribute.label) void update(attribute, { label: next }, "Value renamed");
                  }}
                />
                <AdminStatusChip status={attribute.isActive ? "active" : "inactive"} />
                <button type="button" className="text-button" disabled={busy === attribute._id} onClick={() => void update(attribute, { isActive: !attribute.isActive }, attribute.isActive ? "Value hidden" : "Value restored")}>
                  {attribute.isActive ? "Deactivate" : "Activate"}
                </button>
                <button type="button" className="text-button" disabled={busy === attribute._id} onClick={() => void remove(attribute)}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </>
  );
}
