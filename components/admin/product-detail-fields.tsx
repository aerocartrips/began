"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import Combobox from "@/components/ui/form/combobox";
import Select from "@/components/ui/form/select";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { sendJson } from "@/lib/api/send-json";
import type { AdminAttribute, AdminProductType } from "@/features/products/catalog-setup";

type Value = string | string[];

const BOOLEAN_OPTIONS = [
  { id: "", label: "Not set" },
  { id: "Yes", label: "Yes" },
  { id: "No", label: "No" },
];

/**
 * Adds a value to an attribute's list from the product form, so a new fabric
 * or fit never sends the admin to another page. Returns the canonical value.
 */
export function useAddAttributeValue(onAdded: (attribute: AdminAttribute, value: { label: string; hex: string }) => void) {
  const feedback = useFeedback();
  return async (attribute: AdminAttribute, label: string, hex = "") => {
    try {
      const result = await sendJson<{ label: string; hex: string }>(`/api/v1/admin/attributes/${attribute._id}/values`, "POST", { label, hex });
      if (!result.data) return null;
      onAdded(attribute, result.data);
      return result.data.label;
    } catch (error) {
      feedback.error("Value not added", error instanceof Error ? error.message : undefined);
      return null;
    }
  };
}

const DEFAULT_SWATCH = "#999999";

/**
 * A colour name the browser knows ("Coral", "Sky blue", "Maroon") as #rrggbb,
 * so typing a name presets the swatch; "" for names it doesn't know ("Rani pink").
 */
function hexOfColourName(name: string) {
  const keyword = name.trim().toLowerCase().replace(/\s+/g, "");
  const context = keyword && typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  if (!context) return "";
  const sentinel = "#010203";
  context.fillStyle = sentinel;
  context.fillStyle = keyword;
  const value = String(context.fillStyle);
  return value !== sentinel && /^#[0-9a-f]{6}$/i.test(value) ? value : "";
}

/**
 * "Add a …" link that opens a one-line input for a new list value. Colours
 * get a swatch picker beside the name (preset from the name when the browser
 * knows it), so a new colour never reaches the storefront without its swatch.
 */
export function AddValue({ attribute, onAdd }: { attribute: AdminAttribute; onAdd: (label: string, hex: string) => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [hex, setHex] = useState(DEFAULT_SWATCH);
  // Once the admin picks a swatch, the name no longer changes it.
  const [picked, setPicked] = useState(false);
  const [busy, setBusy] = useState(false);
  const isColour = attribute.input === "color";
  const noun = attribute.name.toLowerCase();
  if (!open) {
    return (
      <button type="button" className="text-button admin-add-value" onClick={() => setOpen(true)}>
        <Plus size={13} aria-hidden="true" /> Add a {noun}
      </button>
    );
  }
  function close() {
    setLabel("");
    setHex(DEFAULT_SWATCH);
    setPicked(false);
    setOpen(false);
  }
  async function add() {
    if (!label.trim()) return;
    setBusy(true);
    await onAdd(label.trim(), isColour ? hex : "");
    setBusy(false);
    close();
  }
  return (
    <span className="admin-add-value__row">
      <input
        aria-label={`New ${noun} name`}
        placeholder={isColour ? "Name, e.g. Coral" : `New ${noun}`}
        value={label}
        maxLength={80}
        autoFocus
        onChange={(event) => {
          const text = event.currentTarget.value;
          setLabel(text);
          if (isColour && !picked) setHex(hexOfColourName(text) || DEFAULT_SWATCH);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void add();
          }
          if (event.key === "Escape") close();
        }}
      />
      {isColour ? (
        <label className="admin-add-value__swatch">
          <input
            type="color"
            value={hex}
            onChange={(event) => {
              setHex(event.currentTarget.value);
              setPicked(true);
            }}
          />
          <span>
            <span className="sr-only">Swatch colour </span>
            {hex.toUpperCase()}
          </span>
        </label>
      ) : null}
      <button type="button" className="text-button" disabled={busy || !label.trim()} onClick={() => void add()}>
        Add
      </button>
      <button type="button" className="text-button" onClick={close}>
        Cancel
      </button>
    </span>
  );
}

/** One product detail, as its attribute's input asks. */
function DetailField({ attribute, required, value, error, onChange, onAddValue }: {
  attribute: AdminAttribute;
  required: boolean;
  value: Value | undefined;
  error?: string;
  onChange: (value: Value) => void;
  onAddValue: (label: string, hex: string) => Promise<string | null>;
}) {
  const label = `${attribute.name}${attribute.input === "number" && attribute.unit ? ` (${attribute.unit})` : ""}${required ? " *" : ""}`;
  const single = Array.isArray(value) ? value[0] ?? "" : value ?? "";
  const empty = Array.isArray(value) ? value.length === 0 : !value;
  // "Required" is said by the asterisk; the reminder shows only while the field is empty.
  const hint = attribute.helpText || (required && empty ? "Needed before the product can be listed." : undefined);
  const listed = attribute.values.filter((entry) => entry.isActive || entry.label === single || (Array.isArray(value) && value.includes(entry.label)));

  if (attribute.input === "select" || attribute.input === "color") {
    const options = listed.map((entry) => ({ id: entry.label, label: entry.label, swatch: attribute.input === "color" ? entry.hex || undefined : undefined }));
    if (single && !options.some((option) => option.id === single)) options.push({ id: single, label: `${single} (not in list)`, swatch: undefined });
    return (
      <div className="admin-detail-field">
        <Combobox className="admin-field" label={label} placeholder="Not set" options={options} value={single} onChange={(next) => onChange(next)} error={error} hint={hint} />
        <AddValue attribute={attribute} onAdd={async (text, hex) => {
          const added = await onAddValue(text, hex);
          if (added) onChange(added);
        }} />
      </div>
    );
  }

  if (attribute.input === "multiselect") {
    const chosen = Array.isArray(value) ? value : value ? [value] : [];
    return (
      <fieldset className="admin-field admin-field-wide admin-detail-field">
        <legend>{label}</legend>
        <div className="admin-chip-toggles admin-chip-toggles--pick" role="group" aria-label={attribute.name}>
          {listed.map((entry) => {
            const on = chosen.includes(entry.label);
            return (
              <button key={entry.label} type="button" aria-pressed={on} onClick={() => onChange(on ? chosen.filter((item) => item !== entry.label) : [...chosen, entry.label])}>
                {entry.label}
              </button>
            );
          })}
        </div>
        <AddValue attribute={attribute} onAdd={async (text) => {
          const added = await onAddValue(text, "");
          if (added && !chosen.includes(added)) onChange([...chosen, added]);
        }} />
        {hint && !error ? <small className="admin-field-hint">{hint}</small> : null}
        {error ? <span className="admin-form-error">{error}</span> : null}
      </fieldset>
    );
  }

  if (attribute.input === "boolean") {
    return <Select className="admin-field" label={label} options={BOOLEAN_OPTIONS} value={single} onChange={(next) => onChange(next)} error={error} hint={hint} />;
  }

  return (
    <label className="admin-field">
      {label}
      <input
        type={attribute.input === "number" ? "number" : "text"}
        step={attribute.input === "number" ? "any" : undefined}
        inputMode={attribute.input === "number" ? "decimal" : undefined}
        maxLength={200}
        value={single}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      {hint && !error ? <small className="admin-field-hint">{hint}</small> : null}
      {error ? <span className="admin-form-error">{error}</span> : null}
    </label>
  );
}

/**
 * The details a product type asks for (Fabric, Fit, Neck…), in its order.
 * Values come from the attribute library, so storefront filters stay clean;
 * a missing value can be added in place.
 */
export default function ProductDetailFields({ type, attributes, values, errors, onChange, onAttributeUpdated }: {
  type: AdminProductType;
  attributes: Map<string, AdminAttribute>;
  values: Record<string, Value>;
  errors: Record<string, string>;
  onChange: (key: string, value: Value) => void;
  onAttributeUpdated: (attribute: AdminAttribute, value: { label: string; hex: string }) => void;
}) {
  const addValue = useAddAttributeValue(onAttributeUpdated);
  if (!type.fields.length) {
    return <p className="admin-image-disclaimer">{type.pluralName} have no details yet. Add some in the product type.</p>;
  }
  return (
    <div className="admin-form-grid">
      {type.fields.map((field) => {
        const attribute = attributes.get(field.key);
        if (!attribute) return null;
        return (
          <DetailField
            key={field.key}
            attribute={attribute}
            required={field.required}
            value={values[field.key]}
            error={errors[`attributes.${field.key}`]}
            onChange={(value) => onChange(field.key, value)}
            onAddValue={(label, hex) => addValue(attribute, label, hex)}
          />
        );
      })}
    </div>
  );
}
