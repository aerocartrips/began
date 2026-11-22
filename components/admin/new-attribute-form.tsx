"use client";

import { useState } from "react";
import LoadingButton from "@/components/ui/buttons/loading-button";
import Select from "@/components/ui/form/select";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { sendJson } from "@/lib/api/send-json";
import { ATTRIBUTE_INPUT_LABELS } from "@/lib/constants/catalog";
import { isListedInput, type AdminAttribute, type AttributeInput } from "@/features/products/catalog-setup";

const HEX = /#[0-9a-fA-F]{6}\b/;

/**
 * "Red #c62a2a" → { label: "Red", hex: "#c62a2a" }; one value per line or comma.
 * @param {string} text
 */
export function parseValueList(text: string) {
  return text
    .split(/[\n,]/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const hex = HEX.exec(line)?.[0] ?? "";
      return { label: line.replace(HEX, "").trim() || line, hex };
    })
    .filter((value, index, all) => all.findIndex((other) => other.label.toLowerCase() === value.label.toLowerCase()) === index);
}

/**
 * Creates a library attribute in place (from the type editor or the
 * attribute library): name, how it's filled in, and its values.
 */
export default function NewAttributeForm({ inputs, onCreated, onCancel }: {
  /** Inputs offered (options only take one-value lists and colours). */
  inputs: AttributeInput[];
  onCreated: (attribute: AdminAttribute) => void;
  onCancel?: () => void;
}) {
  const feedback = useFeedback();
  const [name, setName] = useState("");
  const [input, setInput] = useState<AttributeInput>(inputs[0]);
  const [values, setValues] = useState("");
  const [unit, setUnit] = useState("");
  const [filterable, setFilterable] = useState(true);
  const [saving, setSaving] = useState(false);
  const listed = isListedInput(input);

  async function create() {
    setSaving(true);
    try {
      const result = await sendJson<AdminAttribute>("/api/v1/admin/attributes", "POST", {
        name: name.trim(),
        input,
        ...(input === "number" ? { unit: unit.trim() } : {}),
        ...(listed ? { values: parseValueList(values).map((value) => ({ label: value.label, hex: value.hex })) } : {}),
        filterable: listed || input === "boolean" ? filterable : false,
        ...(input === "color" ? { schemaProperty: "color" } : {}),
      });
      if (result.data) onCreated(result.data);
      feedback.success("Attribute added", name.trim());
    } catch (error) {
      feedback.error("Attribute not added", error instanceof Error ? error.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-inline-panel">
      <div className="admin-form-grid">
        <label className="admin-field">
          Name
          <input value={name} maxLength={60} placeholder="e.g. Sleeve length" onChange={(event) => setName(event.currentTarget.value)} />
        </label>
        <Select
          className="admin-field"
          label="Filled in as"
          options={inputs.map((entry) => ({ id: entry, label: ATTRIBUTE_INPUT_LABELS[entry] }))}
          value={input}
          onChange={(value) => setInput(value as AttributeInput)}
        />
        {listed ? (
          <label className="admin-field admin-field-wide">
            Values
            <textarea
              rows={3}
              value={values}
              placeholder={input === "color" ? "One per line, with a swatch if you like:\nNavy #1f2f57\nMaroon #7a1f2b" : "One per line, or separated by commas"}
              onChange={(event) => setValues(event.currentTarget.value)}
            />
          </label>
        ) : null}
        {input === "number" ? (
          <label className="admin-field">
            Unit
            <input value={unit} maxLength={12} placeholder="m, cm, g…" onChange={(event) => setUnit(event.currentTarget.value)} />
          </label>
        ) : null}
        {listed || input === "boolean" ? (
          <label className="admin-checkbox">
            <input type="checkbox" checked={filterable} onChange={(event) => setFilterable(event.currentTarget.checked)} />
            Shoppers can filter by it
          </label>
        ) : null}
      </div>
      <div className="admin-form-actions">
        {onCancel ? (
          <button type="button" className="text-button" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <LoadingButton type="button" size="sm" loading={saving} disabled={!name.trim()} onClick={() => void create()}>
          Create attribute
        </LoadingButton>
      </div>
    </div>
  );
}
