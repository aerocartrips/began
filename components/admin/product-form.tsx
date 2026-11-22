"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import LoadingButton from "@/components/ui/buttons/loading-button";
import ImageUploader from "@/components/images/image-uploader";
import Combobox from "@/components/ui/form/combobox";
import Select, { toSelectOptions } from "@/components/ui/form/select";
import NoticeCard from "@/components/ui/feedback/notice-card";
import ProductDetailFields from "@/components/admin/product-detail-fields";
import ProductVariantMatrix from "@/components/admin/product-variant-matrix";
import SizeChartEditor from "@/components/admin/size-chart-editor";
import ProductTypeIcon from "@/components/catalog/product-type-icon";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { useTenant } from "@/features/tenant/tenant-provider";
import { draftKey, emptyDraft, toDraft, toPayload, type AdminProductDraft, type AdminProductRecord } from "@/features/products/admin-product";
import type { AdminAttribute } from "@/features/products/catalog-setup";
import type { AdminCatalogData } from "@/lib/admin/catalog-data";

const STATUS_OPTIONS = toSelectOptions([
  ["draft", "Draft (hidden)"],
  ["active", "Active (listed)"],
  ["inactive", "Inactive (hidden)"],
]);

const cloudinaryEnabled = Boolean(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME);

type ProductFormProps = {
  /** Types, attributes and categories, loaded on the server with the page. */
  catalog: AdminCatalogData;
  /** The product being edited; none for a new one. */
  record?: AdminProductRecord;
  /** Type to start a new product as (from /admin/products/new?type=…). */
  initialTypeId?: string;
};

/**
 * Add or edit a product. The product type decides the form: its details
 * (Fabric, Fit…), its options and the variant grid (Colour × Size, a SKU and
 * stock per combination), colour photos and the size guide. Everything the
 * form needs arrives with the page, so it opens ready, with no extra requests.
 */
export default function ProductForm({ catalog, record, initialTypeId }: ProductFormProps) {
  const router = useRouter();
  const feedback = useFeedback();
  const { salesMode } = useTenant();
  const [attributes, setAttributes] = useState<AdminAttribute[]>(catalog.attributes);
  const byKey = useMemo(() => new Map(attributes.map((attribute) => [attribute.key, attribute])), [attributes]);
  const types = catalog.types;
  const [draft, setDraft] = useState<AdminProductDraft>(() => {
    if (record) return toDraft(record, types, new Map(catalog.attributes.map((attribute) => [attribute.key, attribute])));
    const start = types.find((type) => type.id === initialTypeId) ?? (types.filter((type) => type.isActive).length === 1 ? types.find((type) => type.isActive) : null);
    return emptyDraft(start ?? null);
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(draft.id);
  const type = types.find((entry) => entry.id === draft.productType) ?? null;
  const sizeOptions = (type?.options ?? [])
    .filter((option) => byKey.get(option.key)?.input !== "color")
    .map((option) => ({
      key: option.key,
      name: byKey.get(option.key)?.name ?? option.key,
      values: draft.optionValues[option.key]?.length ? draft.optionValues[option.key] : option.values,
    }));
  const chartKey = type?.sizeChart?.optionKey ?? "";

  const set = <K extends keyof AdminProductDraft>(key: K, value: AdminProductDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const patch = (changes: Partial<AdminProductDraft>) => setDraft((current) => ({ ...current, ...changes }));

  /** A value added from the form joins the attribute's list here too. */
  function onAttributeUpdated(attribute: AdminAttribute, value: { label: string; hex: string }) {
    setAttributes((current) =>
      current.map((entry) =>
        entry.key === attribute.key && !entry.values.some((existing) => existing.label === value.label)
          ? { ...entry, values: [...entry.values, { label: value.label, hex: value.hex, isActive: true }] }
          : entry,
      ),
    );
  }

  /** Switching type keeps shared details, clears options (they belong to the type) and, for new products, applies the type's defaults. */
  function changeType(typeId: string) {
    const next = types.find((entry) => entry.id === typeId) ?? null;
    setDraft((current) => {
      const keep = new Set(next?.fields.map((field) => field.key) ?? []);
      return {
        ...current,
        productType: typeId,
        attributes: Object.fromEntries(Object.entries(current.attributes).filter(([key]) => keep.has(key))),
        optionValues: {},
        variants: [],
        colorHex: {},
        colorMedia: {},
        sizeChart: null,
        ...(current.id || !next
          ? {}
          : {
              careInstructions: current.careInstructions || next.defaults.careInstructions,
              hsnCode: current.hsnCode || next.defaults.hsnCode,
              gstRatePercent: current.gstRatePercent || (next.defaults.gstRatePercent === null ? "" : String(next.defaults.gstRatePercent)),
              minimumOrderQuantity: current.minimumOrderQuantity === "1" ? String(next.defaults.minimumOrderQuantity) : current.minimumOrderQuantity,
            }),
      };
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const response = await fetch(isEdit ? `/api/v1/products/${draft.id}` : "/api/v1/products", {
        method: isEdit ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(draft, type, byKey)),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of payload.errors ?? []) fieldErrors[issue.field] ??= issue.message;
        setErrors(fieldErrors);
        feedback.error("Product not saved", payload.message ?? "Check the highlighted fields.");
        return;
      }
      feedback.success(isEdit ? "Product updated" : "Product created", draft.name);
      if (!isEdit) router.push(`/admin/products/${payload.data._id}/edit`);
      else router.refresh();
    } catch {
      feedback.error("Product not saved", "The server could not be reached.");
    } finally {
      setSaving(false);
    }
  }

  const error = (field: string) => (errors[field] ? <span className="admin-form-error">{errors[field]}</span> : null);

  if (!types.length) {
    return (
      <>
        <header className="admin-page-heading">
          <div>
            <p className="admin-eyebrow">Catalogue</p>
            <h1>New product</h1>
          </div>
        </header>
        <NoticeCard
          tone="info"
          title="First, choose what you sell"
          description="Add a product type (Saree, T-shirt, Jeans… or your own). It decides the details this form asks for and the options shoppers choose."
          action={<Link className="button button-primary button-sm" href="/admin/product-types">Add a product type</Link>}
        />
      </>
    );
  }

  return (
    <form className="admin-product-form" onSubmit={onSubmit} noValidate>
      <header className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">Catalogue{type ? ` · ${type.name}` : ""}</p>
          <h1>{isEdit ? `Edit ${draft.name || "product"}` : type ? `New ${type.name.toLowerCase()}` : "New product"}</h1>
        </div>
        <div className="admin-form-actions">
          <Link className="button button-glass button-sm" href="/admin/products">Cancel</Link>
          <LoadingButton type="submit" size="sm" loading={saving} loadingText="Saving…">Save product</LoadingButton>
        </div>
      </header>

      {isEdit && !record?.productType ? (
        <NoticeCard
          tone="warning"
          title="This product was added before product types"
          description="Upgrade the catalogue (Product types page) to keep its details and colours, or choose its type below and fill them in again."
          action={<Link className="button button-glass button-sm" href="/admin/product-types">Product types</Link>}
        />
      ) : null}
      {type && !type.isActive ? (
        <NoticeCard tone="warning" title={`${type.pluralName} are not on sale`} description="The product is saved but stays hidden from the storefront until the type is on sale again." />
      ) : null}

      <section className="admin-form-section" aria-labelledby="type-heading">
        <h2 id="type-heading">What is it?</h2>
        <div className="admin-type-picker" role="radiogroup" aria-label="Product type">
          {types.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="radio"
              aria-checked={draft.productType === entry.id}
              className={entry.isActive ? undefined : "is-off"}
              onClick={() => (draft.productType === entry.id ? undefined : changeType(entry.id))}
            >
              <ProductTypeIcon icon={entry.icon} size={18} />
              <span>{entry.name}</span>
            </button>
          ))}
        </div>
        {error("productType")}
        {isEdit && record?.productType && type && String(typeof record.productType === "string" ? record.productType : record.productType?._id) !== type.id ? (
          <p className="admin-image-disclaimer">Changing the type removes its variants and their stock when you save. Details the new type also has are kept.</p>
        ) : null}
      </section>

      <section className="admin-form-section" aria-labelledby="basics-heading">
        <h2 id="basics-heading">Basics</h2>
        <div className="admin-form-grid">
          <label className="admin-field admin-field-wide">
            Name
            <input required minLength={2} maxLength={180} value={draft.name} onChange={(event) => set("name", event.currentTarget.value)} />
            {error("name")}
          </label>
          <label className="admin-field">
            SKU
            <input required maxLength={64} value={draft.sku} onChange={(event) => set("sku", event.currentTarget.value.toUpperCase())} />
            {error("sku")}
          </label>
          <label className="admin-field">
            URL slug
            <input maxLength={160} placeholder="Generated from the name" value={draft.slug} onChange={(event) => set("slug", event.currentTarget.value)} />
            {error("slug")}
          </label>
          <Combobox
            className="admin-field"
            label="Category"
            required
            placeholder="Choose a category"
            options={catalog.categories.map((category) => ({ id: category._id, label: category.name }))}
            value={draft.categoryId}
            onChange={(id) => set("categoryId", id)}
            error={errors.category}
          />
          <Select className="admin-field" label="Status" options={STATUS_OPTIONS} value={draft.status} onChange={(status) => set("status", status)} />
          <label className="admin-checkbox">
            <input type="checkbox" checked={draft.featured} onChange={(event) => set("featured", event.currentTarget.checked)} />
            Feature on the home page
          </label>
          <label className="admin-field admin-field-wide">
            Short description
            <input maxLength={400} value={draft.shortDescription} onChange={(event) => set("shortDescription", event.currentTarget.value)} />
          </label>
          <label className="admin-field admin-field-wide">
            Description
            <textarea rows={6} maxLength={10000} value={draft.description} onChange={(event) => set("description", event.currentTarget.value)} />
          </label>
        </div>
      </section>

      {type ? (
        <section className="admin-form-section" aria-labelledby="attributes-heading">
          <h2 id="attributes-heading">{type.name} details</h2>
          <p className="admin-image-disclaimer">
            Values come from <Link href="/admin/attributes">Attributes</Link> so storefront filters stay consistent. Fields marked * are needed before the product can be listed.
          </p>
          <ProductDetailFields
            type={type}
            attributes={byKey}
            values={draft.attributes}
            errors={errors}
            onChange={(key, value) => set("attributes", { ...draft.attributes, [key]: value })}
            onAttributeUpdated={onAttributeUpdated}
          />
          <div className="admin-form-grid admin-form-grid--spaced">
            <label className="admin-field admin-field-wide">
              Care instructions
              <textarea rows={3} maxLength={2000} value={draft.careInstructions} onChange={(event) => set("careInstructions", event.currentTarget.value)} />
            </label>
          </div>
        </section>
      ) : null}

      <section className="admin-form-section" aria-labelledby="pricing-heading">
        <h2 id="pricing-heading">Pricing (₹, excluding GST)</h2>
        <p className="admin-image-disclaimer">
          This store sells {salesMode === "wholesale" ? "wholesale: shoppers see the wholesale price, MOQ and quantity tiers" : "retail: shoppers see the retail price and buy single pieces"}. Every variant sells at these prices.
        </p>
        <div className="admin-form-grid">
          <label className="admin-field">
            Retail price
            <input type="number" min={0} step="0.01" required value={draft.price} onChange={(event) => set("price", event.currentTarget.value)} />
            {error("price")}
          </label>
          <label className="admin-field">
            Compare-at price (retail)
            <input type="number" min={0} step="0.01" value={draft.compareAtPrice} onChange={(event) => set("compareAtPrice", event.currentTarget.value)} />
          </label>
          <label className="admin-field">
            Wholesale price per piece
            <input type="number" min={0} step="0.01" required value={draft.wholesalePrice} onChange={(event) => set("wholesalePrice", event.currentTarget.value)} />
            {error("wholesalePrice")}
          </label>
          <label className="admin-field">
            Minimum order quantity
            <input type="number" min={1} step={1} value={draft.minimumOrderQuantity} onChange={(event) => set("minimumOrderQuantity", event.currentTarget.value)} />
          </label>
          <label className="admin-field">
            HSN code
            <input inputMode="numeric" maxLength={8} value={draft.hsnCode} onChange={(event) => set("hsnCode", event.currentTarget.value)} />
            {error("hsnCode")}
          </label>
          <label className="admin-field">
            GST rate % (blank = store default)
            <input type="number" min={0} max={28} step="0.01" value={draft.gstRatePercent} onChange={(event) => set("gstRatePercent", event.currentTarget.value)} />
          </label>
        </div>

        <fieldset className="admin-repeater">
          <legend>Quantity tiers (wholesale)</legend>
          {draft.tiers.map((tier) => (
            <div key={tier.key} className="admin-repeater__row">
              <label className="admin-field">
                From pieces
                <input type="number" min={1} value={tier.minQuantity} onChange={(event) => set("tiers", draft.tiers.map((entry) => (entry.key === tier.key ? { ...entry, minQuantity: event.currentTarget.value } : entry)))} />
              </label>
              <label className="admin-field">
                Price per piece
                <input type="number" min={0} step="0.01" value={tier.pricePerUnit} onChange={(event) => set("tiers", draft.tiers.map((entry) => (entry.key === tier.key ? { ...entry, pricePerUnit: event.currentTarget.value } : entry)))} />
              </label>
              <button type="button" className="icon-button" aria-label="Remove tier" onClick={() => set("tiers", draft.tiers.filter((entry) => entry.key !== tier.key))}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <button type="button" className="text-button" onClick={() => set("tiers", [...draft.tiers, { key: draftKey(), minQuantity: "", pricePerUnit: "" }])}>
            <Plus size={14} aria-hidden="true" /> Add tier
          </button>
        </fieldset>
      </section>

      <section className="admin-form-section" aria-labelledby="variants-heading">
        <h2 id="variants-heading">{type?.options.length ? "Options & stock" : "Stock"}</h2>
        {type?.options.length ? (
          <ProductVariantMatrix draft={draft} type={type} attributes={byKey} errors={errors} onChange={patch} onAttributeUpdated={onAttributeUpdated} />
        ) : null}
        {!draft.variants.length ? (
          <div className="admin-form-grid">
            <label className="admin-field">
              Stock (pieces)
              <input type="number" min={0} step={1} value={draft.stockQuantity} onChange={(event) => set("stockQuantity", event.currentTarget.value)} />
              {error("stockQuantity")}
            </label>
          </div>
        ) : null}
      </section>

      <section className="admin-form-section" aria-labelledby="images-heading">
        <h2 id="images-heading">Photos</h2>
        <p className="admin-image-disclaimer">Shown for every option. Colour photos (above) come first when a shopper picks that colour.</p>
        {cloudinaryEnabled ? (
          <ImageUploader
            images={draft.images}
            onChange={(images) => set("images", images)}
            productId={draft.id}
            productType={type?.slug}
            fabric={typeof draft.attributes.fabric === "string" ? draft.attributes.fabric : undefined}
          />
        ) : (
          <p className="admin-image-disclaimer">Image uploads need Cloudinary (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and server credentials).</p>
        )}
      </section>

      {type && sizeOptions.length ? (
        <section className="admin-form-section" aria-labelledby="chart-heading">
          <h2 id="chart-heading">Size guide</h2>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={draft.sizeChart === null}
              disabled={!type.sizeChart && draft.sizeChart === null && !sizeOptions.length}
              onChange={(event) =>
                set(
                  "sizeChart",
                  event.currentTarget.checked
                    ? null
                    : type.sizeChart
                      ? JSON.parse(JSON.stringify(type.sizeChart))
                      : { optionKey: sizeOptions[0].key, unit: "in", columns: [{ label: "Chest", primary: true, measurement: true }], rows: sizeOptions[0].values.map((size) => ({ size, values: [""] })), note: "", howToMeasure: [] },
                )
              }
            />
            {type.sizeChart ? `Use the ${type.pluralName} size guide` : `No size guide (${type.pluralName} have none)`}
          </label>
          {draft.sizeChart ? (
            <>
              <p className="admin-image-disclaimer">This product&apos;s own measurements, for a fit that differs from the type&apos;s (slim, oversized…).</p>
              <SizeChartEditor chart={draft.sizeChart} onChange={(chart) => set("sizeChart", chart)} options={sizeOptions} />
              {error("sizeChart.optionKey")}
            </>
          ) : chartKey ? (
            <p className="admin-image-disclaimer">
              <Link href={`/admin/product-types/${type.id}`}>Edit the {type.pluralName} size guide</Link>
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="admin-form-section" aria-labelledby="seo-heading">
        <h2 id="seo-heading">Search engine listing</h2>
        <div className="admin-form-grid">
          <label className="admin-field admin-field-wide">
            Page title
            <input maxLength={160} placeholder={draft.name} value={draft.seoTitle} onChange={(event) => set("seoTitle", event.currentTarget.value)} />
          </label>
          <label className="admin-field admin-field-wide">
            Meta description
            <textarea rows={2} maxLength={320} placeholder={draft.shortDescription} value={draft.seoDescription} onChange={(event) => set("seoDescription", event.currentTarget.value)} />
          </label>
        </div>
      </section>
    </form>
  );
}
