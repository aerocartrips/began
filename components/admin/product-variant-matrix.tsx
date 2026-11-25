"use client";

import { useState } from "react";
import ImageUploader, { type ManagedImage } from "@/components/images/image-uploader";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { AddValue, useAddAttributeValue } from "@/components/admin/product-detail-fields";
import { formatNumber } from "@/lib/format";
import { variantSkuOf, variantTitleOf } from "@/lib/catalog/variants";
import { colorKeyOf, variantsFor, type AdminProductDraft, type VariantDraft } from "@/features/products/admin-product";
import type { AdminAttribute, AdminProductType } from "@/features/products/catalog-setup";

const cloudinaryEnabled = Boolean(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME);

type MatrixProps = {
  draft: AdminProductDraft;
  type: AdminProductType;
  attributes: Map<string, AdminAttribute>;
  errors: Record<string, string>;
  /** Applies changes to the draft (option values, variants, colour swatches and photos). */
  onChange: (changes: Partial<AdminProductDraft>) => void;
  onAttributeUpdated: (attribute: AdminAttribute, value: { label: string; hex: string }) => void;
};

/**
 * Options and stock: the admin picks the values the product comes in (colours,
 * sizes…), and every combination becomes a row with its own SKU, barcode and
 * stock. Rows keep their stock when values are added; a value can't be
 * dropped while its rows still hold stock. Each colour has its own swatch and
 * photos, shared by its sizes.
 */
export default function ProductVariantMatrix({ draft, type, attributes, errors, onChange, onAttributeUpdated }: MatrixProps) {
  const feedback = useFeedback();
  const addValue = useAddAttributeValue(onAttributeUpdated);
  const [bulkStock, setBulkStock] = useState("");
  const colorKey = colorKeyOf(type, attributes);
  const colours = colorKey ? draft.optionValues[colorKey] ?? [] : [];
  const totalStock = draft.variants.reduce((total, variant) => total + (Number(variant.stockQuantity) || 0), 0);

  /** The values an option offers here: the type's own list (or all active values), plus any already chosen. */
  const offered = (key: string) => {
    const attribute = attributes.get(key);
    const own = type.options.find((option) => option.key === key)?.values ?? [];
    const base = own.length ? own : (attribute?.values ?? []).filter((value) => value.isActive).map((value) => value.label);
    return [...new Set([...base, ...(draft.optionValues[key] ?? [])])];
  };

  function toggle(key: string, value: string) {
    const current = draft.optionValues[key] ?? [];
    const removing = current.includes(value);
    const order = offered(key);
    const values = removing ? current.filter((entry) => entry !== value) : order.filter((entry) => current.includes(entry) || entry === value);
    if (removing) {
      const stocked = draft.variants.filter((variant) => variant.options[key] === value && Number(variant.stockQuantity) > 0);
      if (stocked.length) {
        const units = stocked.reduce((total, variant) => total + Number(variant.stockQuantity), 0);
        feedback.error(`${value} still has stock`, `${formatNumber(units)} pieces across ${stocked.length} variants. Set their stock to 0 first.`);
        return;
      }
    }
    const optionValues = { ...draft.optionValues, [key]: values };
    onChange({ optionValues, variants: variantsFor({ ...draft, optionValues }, type) });
  }

  const setVariant = (key: string, changes: Partial<VariantDraft>) =>
    onChange({ variants: draft.variants.map((variant) => (variant.key === key ? { ...variant, ...changes } : variant)) });

  /** Adds a value (a colour with its swatch) to the library and chooses it here. */
  async function addOptionValue(key: string, label: string, hex: string) {
    const attribute = attributes.get(key);
    if (!attribute || !label) return;
    const added = await addValue(attribute, label, hex);
    if (added && !(draft.optionValues[key] ?? []).includes(added)) {
      const optionValues = { ...draft.optionValues, [key]: [...(draft.optionValues[key] ?? []), added] };
      onChange({ optionValues, variants: variantsFor({ ...draft, optionValues }, type) });
    }
  }

  const missing = type.options.filter((option) => !(draft.optionValues[option.key] ?? []).length);
  const ownValuesNote = (key: string) => (type.options.find((option) => option.key === key)?.values.length ? ` (as offered for ${type.pluralName})` : "");

  return (
    <div className="admin-variant-matrix">
      {type.options.map((option) => {
        const attribute = attributes.get(option.key);
        const chosen = draft.optionValues[option.key] ?? [];
        return (
          <fieldset key={option.key} className="admin-repeater">
            <legend>
              {attribute?.name ?? option.key}
              <small>
                {" "}
                · {chosen.length ? `${chosen.length} chosen` : "choose at least one"}
                {ownValuesNote(option.key)}
              </small>
            </legend>
            <div className="admin-chip-toggles admin-chip-toggles--pick" role="group" aria-label={`${attribute?.name ?? option.key} values`}>
              {offered(option.key).map((value) => {
                const hex = attribute?.values.find((entry) => entry.label === value)?.hex;
                return (
                  <button key={value} type="button" aria-pressed={chosen.includes(value)} onClick={() => toggle(option.key, value)}>
                    {attribute?.input === "color" ? <span className="swatch" style={{ backgroundColor: draft.colorHex[value] || hex || undefined }} aria-hidden="true" /> : null}
                    {value}
                  </button>
                );
              })}
            </div>
            {attribute && !type.options.find((entry) => entry.key === option.key)?.values.length ? (
              <AddValue attribute={attribute} onAdd={(label, hex) => addOptionValue(option.key, label, hex)} />
            ) : null}
          </fieldset>
        );
      })}

      {missing.length ? (
        <p className="admin-image-disclaimer">
          Choose {missing.map((option) => attributes.get(option.key)?.name.toLowerCase() ?? option.key).join(" and ")} to create variants. Without variants, the product is sold as a single item with one stock figure.
        </p>
      ) : null}
      {errors.variants ? <span className="admin-form-error">{errors.variants}</span> : null}

      {draft.variants.length ? (
        <>
          <div className="admin-variant-matrix__tools">
            <p>
              <strong>{formatNumber(draft.variants.length)}</strong> variants · <strong>{formatNumber(totalStock)}</strong> pieces in stock
            </p>
            <label className="admin-field admin-variant-matrix__bulk">
              Stock for every variant
              <span className="admin-add-value__row">
                <input type="number" min={0} step={1} value={bulkStock} onChange={(event) => setBulkStock(event.currentTarget.value)} />
                <button
                  type="button"
                  className="text-button"
                  disabled={bulkStock === ""}
                  onClick={() => onChange({ variants: draft.variants.map((variant) => ({ ...variant, stockQuantity: String(Math.max(0, Math.trunc(Number(bulkStock) || 0))) })) })}
                >
                  Apply
                </button>
              </span>
            </label>
            <button
              type="button"
              className="text-button"
              onClick={() => onChange({ variants: draft.variants.map((variant) => ({ ...variant, sku: variantSkuOf(draft.sku || "SKU", Object.values(variant.options)) })) })}
            >
              Fill SKUs from {draft.sku || "the product SKU"}
            </button>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table admin-variant-table">
              <thead>
                <tr>
                  <th scope="col">Variant</th>
                  <th scope="col">SKU</th>
                  <th scope="col">Barcode (GTIN)</th>
                  <th scope="col" className="is-numeric">Stock</th>
                </tr>
              </thead>
              <tbody>
                {draft.variants.map((variant, index) => {
                  const colour = colorKey ? variant.options[colorKey] : "";
                  const hex = colour ? draft.colorHex[colour] || attributes.get(colorKey ?? "")?.values.find((entry) => entry.label === colour)?.hex : "";
                  const optionError = Object.entries(errors).find(([field]) => field.startsWith(`variants.${index}.options`))?.[1];
                  return (
                    <tr key={variant.key}>
                      <th scope="row">
                        <span className="admin-variant-table__title">
                          {colour ? <span className="swatch" style={{ backgroundColor: hex || undefined }} aria-hidden="true" /> : null}
                          {variantTitleOf(variant.options)}
                        </span>
                        {optionError ? <span className="admin-form-error">{optionError}</span> : null}
                      </th>
                      <td>
                        <input aria-label={`SKU for ${variantTitleOf(variant.options)}`} maxLength={64} value={variant.sku} onChange={(event) => setVariant(variant.key, { sku: event.currentTarget.value.toUpperCase() })} />
                        {errors[`variants.${index}.sku`] ? <span className="admin-form-error">{errors[`variants.${index}.sku`]}</span> : null}
                      </td>
                      <td>
                        <input aria-label={`Barcode for ${variantTitleOf(variant.options)}`} maxLength={32} inputMode="numeric" value={variant.barcode} onChange={(event) => setVariant(variant.key, { barcode: event.currentTarget.value })} />
                      </td>
                      <td className="is-numeric">
                        <input
                          aria-label={`Stock for ${variantTitleOf(variant.options)}`}
                          type="number"
                          min={0}
                          step={1}
                          value={variant.stockQuantity}
                          onChange={(event) => setVariant(variant.key, { stockQuantity: event.currentTarget.value })}
                        />
                        {errors[`variants.${index}.stockQuantity`] ? <span className="admin-form-error">{errors[`variants.${index}.stockQuantity`]}</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {colours.length ? (
        <fieldset className="admin-repeater">
          <legend>Colour swatches and photos</legend>
          <p className="admin-image-disclaimer">Each colour&apos;s photos are shared by all its sizes and show first when shoppers pick that colour.</p>
          {colours.map((colour) => {
            const libraryHex = attributes.get(colorKey ?? "")?.values.find((entry) => entry.label === colour)?.hex || "#999999";
            return (
              <div key={colour} className="admin-colour-media">
                <div className="admin-repeater__row">
                  <label className="admin-field admin-colour-media__swatch">
                    {colour}
                    <input
                      type="color"
                      value={draft.colorHex[colour] || libraryHex}
                      onChange={(event) => onChange({ colorHex: { ...draft.colorHex, [colour]: event.currentTarget.value } })}
                    />
                  </label>
                </div>
                {cloudinaryEnabled ? (
                  <ImageUploader
                    images={draft.colorMedia[colour] ?? []}
                    onChange={(images: ManagedImage[]) => onChange({ colorMedia: { ...draft.colorMedia, [colour]: images } })}
                    // No productId: colour photos stay out of the product's main gallery until the form is saved.
                    productType={type.slug}
                    fabric={typeof draft.attributes.fabric === "string" ? draft.attributes.fabric : undefined}
                    maxImages={12}
                  />
                ) : null}
              </div>
            );
          })}
        </fieldset>
      ) : null}
    </div>
  );
}
