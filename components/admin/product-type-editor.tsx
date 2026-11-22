"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import AdminCard from "@/components/admin/admin-card";
import NewAttributeForm from "@/components/admin/new-attribute-form";
import SizeChartEditor from "@/components/admin/size-chart-editor";
import ProductTypeIcon from "@/components/catalog/product-type-icon";
import LoadingButton from "@/components/ui/buttons/loading-button";
import Combobox from "@/components/ui/form/combobox";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { sendJson } from "@/lib/api/send-json";
import { isClientApiError } from "@/lib/api/api-error";
import { ATTRIBUTE_INPUT_LABELS, MAX_TYPE_OPTIONS, PRODUCT_TYPE_ICONS } from "@/lib/constants/catalog";
import { formatNumber } from "@/lib/format";
import {
  OPTION_INPUTS,
  emptySizeChart,
  type AdminAttribute,
  type AdminProductType,
  type AttributeInput,
} from "@/features/products/catalog-setup";

const ALL_INPUTS = Object.keys(ATTRIBUTE_INPUT_LABELS) as AttributeInput[];

const move = <T,>(list: T[], index: number, step: number) => {
  const next = [...list];
  const target = index + step;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

type TypeDraft = Pick<AdminProductType, "name" | "pluralName" | "slug" | "description" | "icon" | "isActive" | "fields" | "options" | "sizeChart" | "defaults">;

/**
 * Editor for one product type: its name and icon, the details its products
 * describe (in order, each optionally required before listing), the options
 * shoppers choose (up to three, each offering all or some of its values), the
 * size chart and the defaults new products start with.
 */
export default function ProductTypeEditor({ type, attributes: initialAttributes }: { type: AdminProductType; attributes: AdminAttribute[] }) {
  const router = useRouter();
  const feedback = useFeedback();
  const [attributes, setAttributes] = useState(initialAttributes);
  const [draft, setDraft] = useState<TypeDraft>(() => ({
    name: type.name,
    pluralName: type.pluralName,
    slug: type.slug,
    description: type.description,
    icon: type.icon,
    isActive: type.isActive,
    fields: type.fields.map((field) => ({ ...field })),
    options: type.options.map((option) => ({ ...option, values: [...option.values] })),
    sizeChart: type.sizeChart,
    defaults: { ...type.defaults },
  }));
  const [creating, setCreating] = useState<"field" | "option" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const byKey = new Map(attributes.map((attribute) => [attribute.key, attribute]));
  const used = new Set([...draft.fields.map((field) => field.key), ...draft.options.map((option) => option.key)]);
  const set = (changes: Partial<TypeDraft>) => setDraft((current) => ({ ...current, ...changes }));
  const nameOf = (key: string) => byKey.get(key)?.name ?? key;

  const optionChoices = draft.options.map((option) => ({
    key: option.key,
    name: nameOf(option.key),
    values: option.values.length ? option.values : (byKey.get(option.key)?.values ?? []).filter((value) => value.isActive).map((value) => value.label),
  }));
  const sizeCandidates = optionChoices.filter((option) => byKey.get(option.key)?.input !== "color");

  function addAttribute(attribute: AdminAttribute, as: "field" | "option") {
    setAttributes((current) => (current.some((entry) => entry.key === attribute.key) ? current : [...current, attribute]));
    if (as === "field") set({ fields: [...draft.fields, { key: attribute.key, required: false }] });
    else set({ options: [...draft.options, { key: attribute.key, values: [] }] });
    setCreating(null);
  }

  function toggleOptionValue(index: number, value: string) {
    const option = draft.options[index];
    const all = (byKey.get(option.key)?.values ?? []).filter((entry) => entry.isActive).map((entry) => entry.label);
    // An empty list means every value; the first untick turns it into an explicit list.
    const current = option.values.length ? option.values : all;
    const next = current.includes(value) ? current.filter((entry) => entry !== value) : all.filter((entry) => current.includes(entry) || entry === value);
    set({ options: draft.options.map((entry, position) => (position === index ? { ...entry, values: next.length === all.length ? [] : next } : entry)) });
  }

  async function save() {
    setSaving(true);
    setErrors({});
    try {
      await sendJson(`/api/v1/admin/product-types/${type.id}`, "PATCH", {
        name: draft.name.trim(),
        pluralName: draft.pluralName.trim(),
        slug: draft.slug.trim(),
        description: draft.description.trim(),
        icon: draft.icon,
        isActive: draft.isActive,
        fields: draft.fields,
        options: draft.options,
        sizeChart: draft.sizeChart,
        defaults: {
          ...draft.defaults,
          gstRatePercent: draft.defaults.gstRatePercent === null || Number.isNaN(draft.defaults.gstRatePercent) ? null : draft.defaults.gstRatePercent,
        },
      });
      feedback.success("Product type saved", draft.pluralName);
      router.refresh();
    } catch (error) {
      if (isClientApiError(error)) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of error.errors ?? []) fieldErrors[issue.field] ??= issue.message;
        setErrors(fieldErrors);
      }
      feedback.error("Not saved", error instanceof Error ? error.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  const fieldError = (name: string) => (errors[name] ? <span className="admin-form-error">{errors[name]}</span> : null);
  const available = (inputs: AttributeInput[]) =>
    attributes.filter((attribute) => !used.has(attribute.key) && inputs.includes(attribute.input)).map((attribute) => ({
      id: attribute.key,
      label: attribute.name,
      description: ATTRIBUTE_INPUT_LABELS[attribute.input],
    }));

  return (
    <div className="admin-product-form">
      <header className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">
            <Link href="/admin/product-types">Product types</Link>
          </p>
          <h1>{draft.pluralName || "Product type"}</h1>
          <p>
            {formatNumber(type.productCount)} products, {formatNumber(type.listedCount)} active.{" "}
            {type.productCount ? <Link href={`/admin/products?type=${type.id}`}>See them</Link> : null}
          </p>
        </div>
        <div className="admin-form-actions">
          <Link className="button button-glass button-sm" href="/admin/product-types">Back</Link>
          <LoadingButton type="button" size="sm" loading={saving} loadingText="Saving…" onClick={() => void save()}>Save type</LoadingButton>
        </div>
      </header>

      <section className="admin-form-section" aria-labelledby="type-basics">
        <h2 id="type-basics">Basics</h2>
        <div className="admin-form-grid">
          <label className="admin-field">
            Name (one)
            <input value={draft.name} maxLength={60} onChange={(event) => set({ name: event.currentTarget.value })} />
            {fieldError("name")}
          </label>
          <label className="admin-field">
            Name (several)
            <input value={draft.pluralName} maxLength={60} placeholder="Shown in navigation" onChange={(event) => set({ pluralName: event.currentTarget.value })} />
          </label>
          <label className="admin-field">
            Address
            <input value={draft.slug} maxLength={80} onChange={(event) => set({ slug: event.currentTarget.value.toLowerCase() })} />
            <small className="admin-field-hint">/shop/{draft.slug || "…"} (old addresses redirect after a change)</small>
            {fieldError("slug")}
          </label>
          <label className="account-toggle admin-type-toggle">
            <span className="account-toggle-copy">
              <strong>On sale</strong>
              <small>Off hides every product of this type from the storefront.</small>
            </span>
            <input type="checkbox" role="switch" checked={draft.isActive} onChange={(event) => set({ isActive: event.currentTarget.checked })} />
            <span className="account-switch" aria-hidden="true" />
          </label>
          <label className="admin-field admin-field-wide">
            Description
            <textarea rows={2} maxLength={600} value={draft.description} placeholder="Shown on the type's page and to search engines" onChange={(event) => set({ description: event.currentTarget.value })} />
          </label>
          <fieldset className="admin-field admin-field-wide admin-icon-picker">
            <legend>Icon</legend>
            <div role="radiogroup" aria-label="Icon">
              {PRODUCT_TYPE_ICONS.map((icon) => (
                <button key={icon} type="button" role="radio" aria-checked={draft.icon === icon} aria-label={icon} title={icon} onClick={() => set({ icon })}>
                  <ProductTypeIcon icon={icon} size={18} />
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      </section>

      <section className="admin-form-section" aria-labelledby="type-fields">
        <h2 id="type-fields">Product details</h2>
        <p className="admin-image-disclaimer">
          What the product form asks for, and the product page lists, in this order. Required details must be filled in before a product is listed (drafts can be saved without them).
        </p>
        {draft.fields.length ? (
          <ol className="admin-type-fields">
            {draft.fields.map((field, index) => {
              const attribute = byKey.get(field.key);
              return (
                <li key={field.key}>
                  <span className="admin-type-fields__name">
                    <strong>{nameOf(field.key)}</strong>
                    <small>{attribute ? ATTRIBUTE_INPUT_LABELS[attribute.input] : "Missing attribute"}{attribute?.filterable ? " · filter" : ""}</small>
                  </span>
                  <label className="admin-checkbox">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(event) => {
                        const required = event.currentTarget.checked;
                        set({ fields: draft.fields.map((entry, position) => (position === index ? { ...entry, required } : entry)) });
                      }}
                    />
                    Required to list
                  </label>
                  <div className="admin-size-chart__row-actions">
                    <button type="button" className="icon-button" aria-label={`Move ${nameOf(field.key)} up`} disabled={index === 0} onClick={() => set({ fields: move(draft.fields, index, -1) })}>
                      <ArrowUp size={13} />
                    </button>
                    <button type="button" className="icon-button" aria-label={`Move ${nameOf(field.key)} down`} disabled={index === draft.fields.length - 1} onClick={() => set({ fields: move(draft.fields, index, 1) })}>
                      <ArrowDown size={13} />
                    </button>
                    <button type="button" className="icon-button" aria-label={`Remove ${nameOf(field.key)}`} onClick={() => set({ fields: draft.fields.filter((_, position) => position !== index) })}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="admin-image-disclaimer">No details yet.</p>
        )}
        {fieldError("fields")}
        <div className="admin-repeater__row">
          <Combobox
            key={`field-${draft.fields.length}`}
            className="admin-field"
            label="Add a detail"
            placeholder="Choose from your attributes"
            options={available(ALL_INPUTS)}
            onChange={(key) => {
              const attribute = byKey.get(key);
              if (attribute) addAttribute(attribute, "field");
            }}
          />
          <button type="button" className="text-button" onClick={() => setCreating(creating === "field" ? null : "field")}>
            <Plus size={14} aria-hidden="true" /> New attribute
          </button>
        </div>
        {creating === "field" ? <NewAttributeForm inputs={ALL_INPUTS} onCreated={(attribute) => addAttribute(attribute, "field")} onCancel={() => setCreating(null)} /> : null}
      </section>

      <section className="admin-form-section" aria-labelledby="type-options">
        <h2 id="type-options">Options shoppers choose</h2>
        <p className="admin-image-disclaimer">
          Each combination (Red / M) becomes a variant with its own SKU and stock. Up to {MAX_TYPE_OPTIONS} options; untick the values this type isn&apos;t sold in.
        </p>
        {draft.options.map((option, index) => {
          const attribute = byKey.get(option.key);
          const values = (attribute?.values ?? []).filter((value) => value.isActive || option.values.includes(value.label));
          const offered = (value: string) => option.values.length === 0 || option.values.includes(value);
          return (
            <fieldset key={option.key} className="admin-repeater">
              <legend>
                {index + 1}. {nameOf(option.key)}
              </legend>
              <div className="admin-chip-toggles" role="group" aria-label={`${nameOf(option.key)} values`}>
                {values.map((value) => (
                  <button key={value.label} type="button" aria-pressed={offered(value.label)} onClick={() => toggleOptionValue(index, value.label)}>
                    {attribute?.input === "color" ? <span className="swatch" style={{ backgroundColor: value.hex || undefined }} aria-hidden="true" /> : null}
                    {value.label}
                  </button>
                ))}
                {!values.length ? <span className="admin-image-disclaimer">No values yet: add them in <Link href="/admin/attributes">Attributes</Link>.</span> : null}
              </div>
              {fieldError(`options.${index}.values`)}
              <div className="admin-size-chart__row-actions">
                <button type="button" className="icon-button" aria-label={`Move ${nameOf(option.key)} up`} disabled={index === 0} onClick={() => set({ options: move(draft.options, index, -1) })}>
                  <ArrowUp size={13} />
                </button>
                <button type="button" className="icon-button" aria-label={`Move ${nameOf(option.key)} down`} disabled={index === draft.options.length - 1} onClick={() => set({ options: move(draft.options, index, 1) })}>
                  <ArrowDown size={13} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remove ${nameOf(option.key)}`}
                  onClick={() =>
                    set({
                      options: draft.options.filter((_, position) => position !== index),
                      sizeChart: draft.sizeChart?.optionKey === option.key ? null : draft.sizeChart,
                    })
                  }
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </fieldset>
          );
        })}
        {fieldError("options")}
        {draft.options.length < MAX_TYPE_OPTIONS ? (
          <>
            <div className="admin-repeater__row">
              <Combobox
                key={`option-${draft.options.length}`}
                className="admin-field"
                label="Add an option"
                placeholder="Colour, Size…"
                options={available(OPTION_INPUTS)}
                onChange={(key) => {
                  const attribute = byKey.get(key);
                  if (attribute) addAttribute(attribute, "option");
                }}
              />
              <button type="button" className="text-button" onClick={() => setCreating(creating === "option" ? null : "option")}>
                <Plus size={14} aria-hidden="true" /> New option attribute
              </button>
            </div>
            {creating === "option" ? <NewAttributeForm inputs={OPTION_INPUTS} onCreated={(attribute) => addAttribute(attribute, "option")} onCancel={() => setCreating(null)} /> : null}
          </>
        ) : null}
      </section>

      <section className="admin-form-section" aria-labelledby="type-chart">
        <h2 id="type-chart">Size guide</h2>
        {draft.sizeChart ? (
          <>
            <p className="admin-image-disclaimer">
              Shown from the product page next to the size option, with an inches/centimetres switch and a fit finder that suggests a size from one measurement.
            </p>
            <SizeChartEditor chart={draft.sizeChart} onChange={(sizeChart) => set({ sizeChart })} options={sizeCandidates} />
            {fieldError("sizeChart.optionKey")}
            <button type="button" className="text-button admin-danger-text" onClick={() => set({ sizeChart: null })}>
              Remove the size guide
            </button>
          </>
        ) : sizeCandidates.length ? (
          <>
            <p className="admin-image-disclaimer">Help shoppers pick the right size: add measurements for each size.</p>
            <button type="button" className="text-button" onClick={() => set({ sizeChart: emptySizeChart(sizeCandidates[0].key, sizeCandidates[0].values) })}>
              <Plus size={14} aria-hidden="true" /> Add a size guide
            </button>
          </>
        ) : (
          <p className="admin-image-disclaimer">Add a size option (such as Size or Waist size) to give this type a size guide.</p>
        )}
      </section>

      <section className="admin-form-section" aria-labelledby="type-defaults">
        <h2 id="type-defaults">Defaults for new products</h2>
        <div className="admin-form-grid">
          <label className="admin-field">
            HSN code
            <input inputMode="numeric" maxLength={8} value={draft.defaults.hsnCode} onChange={(event) => set({ defaults: { ...draft.defaults, hsnCode: event.currentTarget.value } })} />
            {fieldError("defaults.hsnCode")}
          </label>
          <label className="admin-field">
            GST rate % (blank = store default)
            <input
              type="number"
              min={0}
              max={28}
              step="0.01"
              value={draft.defaults.gstRatePercent ?? ""}
              onChange={(event) => set({ defaults: { ...draft.defaults, gstRatePercent: event.currentTarget.value === "" ? null : Number(event.currentTarget.value) } })}
            />
          </label>
          <label className="admin-field">
            Minimum order quantity
            <input type="number" min={1} step={1} value={draft.defaults.minimumOrderQuantity} onChange={(event) => set({ defaults: { ...draft.defaults, minimumOrderQuantity: Number(event.currentTarget.value) || 1 } })} />
          </label>
          <label className="admin-field admin-field-wide">
            Care instructions
            <textarea rows={2} maxLength={2000} value={draft.defaults.careInstructions} onChange={(event) => set({ defaults: { ...draft.defaults, careInstructions: event.currentTarget.value } })} />
          </label>
        </div>
      </section>
    </div>
  );
}
