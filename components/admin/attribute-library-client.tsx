"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import AdminCard from "@/components/admin/admin-card";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import AdminStatusChip from "@/components/admin/admin-status-chip";
import NewAttributeForm, { parseValueList } from "@/components/admin/new-attribute-form";
import LoadingButton from "@/components/ui/buttons/loading-button";
import Select from "@/components/ui/form/select";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { sendJson } from "@/lib/api/send-json";
import { ATTRIBUTE_INPUT_LABELS, FILTERABLE_INPUTS, SCHEMA_PROPERTY_LABELS } from "@/lib/constants/catalog";
import { formatNumber } from "@/lib/format";
import { isListedInput, type AdminAttribute, type AdminAttributeValue, type AttributeInput } from "@/features/products/catalog-setup";

const ALL_INPUTS = Object.keys(ATTRIBUTE_INPUT_LABELS) as AttributeInput[];
const SCHEMA_OPTIONS = Object.entries(SCHEMA_PROPERTY_LABELS).map(([id, label]) => ({ id, label }));

const move = <T,>(list: T[], index: number, step: number) => {
  const next = [...list];
  const target = index + step;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

/** One attribute's settings and its list of values, saved together. */
function AttributeEditor({ attribute, onDone }: { attribute: AdminAttribute; onDone: () => void }) {
  const router = useRouter();
  const feedback = useFeedback();
  const [draft, setDraft] = useState(() => ({ ...attribute, values: attribute.values.map((value) => ({ ...value })) }));
  const [newValues, setNewValues] = useState("");
  const [saving, setSaving] = useState<"save" | "delete" | null>(null);
  const listed = isListedInput(attribute.input);
  const set = (changes: Partial<AdminAttribute>) => setDraft((current) => ({ ...current, ...changes }));
  const setValue = (index: number, changes: Partial<AdminAttributeValue>) =>
    set({ values: draft.values.map((value, position) => (position === index ? { ...value, ...changes } : value)) });
  const renamed = draft.values.filter((value) => value._id && attribute.values.find((original) => original._id === value._id)?.label !== value.label);

  function addValues() {
    const known = new Set(draft.values.map((value) => value.label.toLowerCase()));
    const added = parseValueList(newValues).filter((value) => !known.has(value.label.toLowerCase()));
    set({ values: [...draft.values, ...added.map((value) => ({ label: value.label, hex: value.hex || (attribute.input === "color" ? "#999999" : ""), isActive: true }))] });
    setNewValues("");
  }

  async function save() {
    setSaving("save");
    try {
      await sendJson(`/api/v1/admin/attributes/${attribute._id}`, "PATCH", {
        name: draft.name.trim(),
        unit: draft.unit,
        helpText: draft.helpText,
        filterable: draft.filterable,
        visible: draft.visible,
        schemaProperty: draft.schemaProperty,
        ...(listed ? { values: draft.values.map(({ _id, label, hex, isActive }) => ({ ...(_id ? { _id } : {}), label: label.trim(), hex: hex ?? "", isActive })) } : {}),
      });
      feedback.success("Attribute saved", renamed.length ? `${renamed.length} renamed ${renamed.length === 1 ? "value was" : "values were"} updated on every product.` : draft.name);
      router.refresh();
      onDone();
    } catch (error) {
      feedback.error("Not saved", error instanceof Error ? error.message : undefined);
    } finally {
      setSaving(null);
    }
  }

  async function remove() {
    setSaving("delete");
    try {
      await sendJson(`/api/v1/admin/attributes/${attribute._id}`, "DELETE");
      feedback.success("Attribute deleted", attribute.name);
      router.refresh();
      onDone();
    } catch (error) {
      feedback.error("Not deleted", error instanceof Error ? error.message : undefined);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="admin-stack">
      <div className="admin-form-grid">
        <label className="admin-field">
          Name
          <input value={draft.name} maxLength={60} onChange={(event) => set({ name: event.currentTarget.value })} />
        </label>
        <label className="admin-field">
          Key (in filter links)
          <input value={attribute.key} readOnly aria-readonly="true" />
          <small className="admin-field-hint">/products?{attribute.key}=… · fixed once created</small>
        </label>
        {attribute.input === "number" ? (
          <label className="admin-field">
            Unit
            <input value={draft.unit} maxLength={12} onChange={(event) => set({ unit: event.currentTarget.value })} />
          </label>
        ) : null}
        <Select
          className="admin-field"
          label="Means, for search engines"
          options={SCHEMA_OPTIONS}
          value={draft.schemaProperty}
          onChange={(schemaProperty) => set({ schemaProperty })}
          hint="Lets Google show colour, size, material or gender in results."
        />
        <label className="admin-field admin-field-wide">
          Help text in the product form
          <input value={draft.helpText} maxLength={200} onChange={(event) => set({ helpText: event.currentTarget.value })} />
        </label>
        {FILTERABLE_INPUTS.includes(attribute.input) ? (
          <label className="admin-checkbox">
            <input type="checkbox" checked={draft.filterable} onChange={(event) => set({ filterable: event.currentTarget.checked })} />
            Storefront filter
          </label>
        ) : null}
        <label className="admin-checkbox">
          <input type="checkbox" checked={draft.visible} onChange={(event) => set({ visible: event.currentTarget.checked })} />
          Listed in product specifications
        </label>
      </div>

      {listed ? (
        <fieldset className="admin-repeater">
          <legend>Values</legend>
          <p className="admin-image-disclaimer">Renaming a value renames it on every product. Deactivate values you no longer offer; delete only unused ones.</p>
          <ul className="admin-attribute-list">
            {draft.values.map((value, index) => (
              <li key={value._id ?? `new-${index}`}>
                {attribute.input === "color" ? (
                  <input type="color" aria-label={`Swatch for ${value.label}`} value={value.hex || "#999999"} onChange={(event) => setValue(index, { hex: event.currentTarget.value })} />
                ) : null}
                <input className="admin-inline-input" aria-label="Value" value={value.label} maxLength={80} onChange={(event) => setValue(index, { label: event.currentTarget.value })} />
                <AdminStatusChip status={value.isActive ? "active" : "inactive"} />
                <button type="button" className="text-button" onClick={() => setValue(index, { isActive: !value.isActive })}>
                  {value.isActive ? "Deactivate" : "Activate"}
                </button>
                <span className="admin-size-chart__row-actions">
                  <button type="button" className="icon-button" aria-label={`Move ${value.label} up`} disabled={index === 0} onClick={() => set({ values: move(draft.values, index, -1) })}>
                    <ArrowUp size={13} />
                  </button>
                  <button type="button" className="icon-button" aria-label={`Move ${value.label} down`} disabled={index === draft.values.length - 1} onClick={() => set({ values: move(draft.values, index, 1) })}>
                    <ArrowDown size={13} />
                  </button>
                  <button type="button" className="icon-button" aria-label={`Delete ${value.label}`} onClick={() => set({ values: draft.values.filter((_, position) => position !== index) })}>
                    <Trash2 size={13} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <label className="admin-field admin-field-wide">
            Add values
            <textarea
              rows={2}
              value={newValues}
              placeholder={attribute.input === "color" ? "One per line, swatch optional: Navy #1f2f57" : "One per line, or separated by commas"}
              onChange={(event) => setNewValues(event.currentTarget.value)}
            />
          </label>
          <button type="button" className="text-button" disabled={!newValues.trim()} onClick={addValues}>
            <Plus size={14} aria-hidden="true" /> Add to the list
          </button>
        </fieldset>
      ) : null}

      <div className="admin-form-actions">
        {attribute.usedBy?.length || attribute.productCount ? (
          <small className="admin-field-hint">In use, so it can&apos;t be deleted.</small>
        ) : (
          <button type="button" className="text-button admin-danger-text" disabled={saving !== null} onClick={() => void remove()}>
            Delete attribute
          </button>
        )}
        <button type="button" className="text-button" onClick={onDone}>Cancel</button>
        <LoadingButton type="button" size="sm" loading={saving === "save"} onClick={() => void save()}>Save attribute</LoadingButton>
      </div>
    </div>
  );
}

/**
 * Admin → Attributes: the store's reusable product details and options
 * (Fabric, Colour, Size, Fit…). Product types pick from these; storefront
 * filters and product specifications use exactly these values.
 */
export default function AttributeLibraryClient({ attributes }: { attributes: AdminAttribute[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const current = attributes.find((attribute) => attribute._id === editing) ?? null;

  return (
    <>
      <AdminPageHeading
        eyebrow="Catalogue"
        title="Attributes"
        description="Reusable product details and options. Product types pick from these, and storefront filters use exactly these values, so they stay clean."
      />
      <div className="admin-detail-grid">
        <AdminCard title="Your attributes" description={`${formatNumber(attributes.length)} attributes`}>
          {attributes.length ? (
            <div className="admin-table-wrap is-flush">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Attribute</th>
                    <th scope="col">Filled in as</th>
                    <th scope="col" className="is-numeric">Values</th>
                    <th scope="col">Used by</th>
                    <th scope="col" className="is-numeric">Products</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {attributes.map((attribute) => (
                    <tr key={attribute._id} aria-current={attribute._id === editing ? "true" : undefined}>
                      <td>
                        <strong>{attribute.name}</strong>
                        <small className="admin-cell-sub">
                          {attribute.key}
                          {attribute.filterable ? " · filter" : ""}
                          {attribute.schemaProperty ? ` · ${SCHEMA_PROPERTY_LABELS[attribute.schemaProperty as keyof typeof SCHEMA_PROPERTY_LABELS] ?? attribute.schemaProperty}` : ""}
                        </small>
                      </td>
                      <td>{ATTRIBUTE_INPUT_LABELS[attribute.input]}</td>
                      <td className="is-numeric">{isListedInput(attribute.input) ? formatNumber(attribute.values.filter((value) => value.isActive).length) : "—"}</td>
                      <td>
                        {attribute.usedBy?.length
                          ? attribute.usedBy.map((use, index) => (
                              <span key={use.id}>
                                {index ? ", " : ""}
                                <Link href={`/admin/product-types/${use.id}`}>{use.name}</Link>
                                {use.as === "option" ? " (option)" : ""}
                              </span>
                            ))
                          : "—"}
                      </td>
                      <td className="is-numeric">{formatNumber(attribute.productCount ?? 0)}</td>
                      <td>
                        <button type="button" className="text-button" onClick={() => setEditing(attribute._id)}>Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-empty-results" role="status">No attributes yet. Product type templates add the usual ones, or create your own.</div>
          )}
        </AdminCard>
        <AdminCard title={current ? `Edit ${current.name}` : "New attribute"} description={current ? ATTRIBUTE_INPUT_LABELS[current.input] : "A detail products describe, or an option shoppers choose."}>
          {current ? (
            <AttributeEditor key={current._id} attribute={current} onDone={() => setEditing(null)} />
          ) : (
            <NewAttributeForm inputs={ALL_INPUTS} onCreated={() => router.refresh()} />
          )}
        </AdminCard>
      </div>
    </>
  );
}
