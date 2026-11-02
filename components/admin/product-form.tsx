"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import LoadingButton from "@/components/ui/buttons/loading-button";
import ImageUploader, { type ManagedImage } from "@/components/images/image-uploader";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { useTenant } from "@/features/tenant/tenant-provider";
import {
  draftKey,
  emptyDraft,
  toPayload,
  type AdminProductDraft,
  type VariantDraft,
} from "@/features/products/admin-product";

type Option = { label: string; hex?: string };
type AttributeOptions = Record<"fabric" | "weave" | "occasion" | "pattern" | "color", Option[]>;
type Category = { _id: string; name: string };

const EMPTY_OPTIONS: AttributeOptions = { fabric: [], weave: [], occasion: [], pattern: [], color: [] };
const cloudinaryEnabled = Boolean(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME);

/** Categories and the store's attribute lists for the selects. */
function useCatalogOptions() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [attributes, setAttributes] = useState<AttributeOptions>(EMPTY_OPTIONS);

  useEffect(() => {
    const controller = new AbortController();
    const load = (url: string) => fetch(url, { credentials: "include", signal: controller.signal }).then((response) => response.json());
    Promise.all([load("/api/v1/categories?includeInactive=true"), load("/api/v1/admin/attributes")])
      .then(([categoryPayload, attributePayload]) => {
        setCategories(categoryPayload.data ?? []);
        const grouped: AttributeOptions = { fabric: [], weave: [], occasion: [], pattern: [], color: [] };
        for (const attribute of attributePayload.data ?? []) {
          if (attribute.isActive && attribute.type in grouped) {
            grouped[attribute.type as keyof AttributeOptions].push({ label: attribute.label, hex: attribute.hex });
          }
        }
        setAttributes(grouped);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return { categories, attributes };
}

/** Select from the store's list, or free text when the store has not defined one yet. */
function AttributeField({ label, name, value, options, onChange }: {
  label: string;
  name: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="admin-field">
      {label}
      {options.length > 0 ? (
        <select name={name} value={value} onChange={(event) => onChange(event.currentTarget.value)}>
          <option value="">Not set</option>
          {options.map((option) => <option key={option.label} value={option.label}>{option.label}</option>)}
          {value && !options.some((option) => option.label === value) ? <option value={value}>{value} (not in list)</option> : null}
        </select>
      ) : (
        <input name={name} value={value} maxLength={80} onChange={(event) => onChange(event.currentTarget.value)} />
      )}
    </label>
  );
}

export default function ProductForm({ initial }: { initial?: AdminProductDraft }) {
  const router = useRouter();
  const feedback = useFeedback();
  const { salesMode } = useTenant();
  const { categories, attributes } = useCatalogOptions();
  const [draft, setDraft] = useState<AdminProductDraft>(() => initial ?? emptyDraft());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(draft.id);

  const set = <K extends keyof AdminProductDraft>(key: K, value: AdminProductDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const setVariant = (key: string, changes: Partial<VariantDraft>) =>
    set("variants", draft.variants.map((variant) => (variant.key === key ? { ...variant, ...changes } : variant)));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const response = await fetch(isEdit ? `/api/v1/products/${draft.id}` : "/api/v1/products", {
        method: isEdit ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(draft)),
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
  const totalVariantStock = draft.variants.reduce((total, variant) => total + (Number(variant.stockQuantity) || 0), 0);

  return (
    <form className="admin-product-form" onSubmit={onSubmit} noValidate>
      <header className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">Catalogue</p>
          <h1>{isEdit ? `Edit ${draft.name || "product"}` : "New product"}</h1>
        </div>
        <div className="admin-form-actions">
          <Link className="button button-glass button-sm" href="/admin/products">Cancel</Link>
          <LoadingButton type="submit" size="sm" loading={saving} loadingText="Saving…">Save product</LoadingButton>
        </div>
      </header>

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
          <label className="admin-field">
            Category
            <select required value={draft.categoryId} onChange={(event) => set("categoryId", event.currentTarget.value)}>
              <option value="">Choose a category</option>
              {categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
            </select>
            {error("category")}
          </label>
          <label className="admin-field">
            Status
            <select value={draft.status} onChange={(event) => set("status", event.currentTarget.value)}>
              <option value="draft">Draft (hidden)</option>
              <option value="active">Active (listed)</option>
              <option value="inactive">Inactive (hidden)</option>
            </select>
          </label>
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

      <section className="admin-form-section" aria-labelledby="attributes-heading">
        <h2 id="attributes-heading">Saree details</h2>
        <p className="admin-image-disclaimer">
          Values come from <Link href="/admin/attributes">Attributes</Link> so storefront filters stay consistent.
        </p>
        <div className="admin-form-grid">
          <AttributeField label="Fabric" name="fabric" value={draft.fabric} options={attributes.fabric} onChange={(value) => set("fabric", value)} />
          <AttributeField label="Weave" name="weavingType" value={draft.weavingType} options={attributes.weave} onChange={(value) => set("weavingType", value)} />
          <AttributeField label="Occasion" name="occasion" value={draft.occasion} options={attributes.occasion} onChange={(value) => set("occasion", value)} />
          <AttributeField label="Pattern" name="design" value={draft.design} options={attributes.pattern} onChange={(value) => set("design", value)} />
          <label className="admin-field">
            Saree length
            <input maxLength={40} value={draft.sareeLength} onChange={(event) => set("sareeLength", event.currentTarget.value)} />
          </label>
          <label className="admin-field">
            Blouse piece
            <input maxLength={40} value={draft.blousePiece} onChange={(event) => set("blousePiece", event.currentTarget.value)} />
          </label>
          <label className="admin-field admin-field-wide">
            Care instructions
            <textarea rows={3} maxLength={2000} value={draft.careInstructions} onChange={(event) => set("careInstructions", event.currentTarget.value)} />
          </label>
        </div>
      </section>

      <section className="admin-form-section" aria-labelledby="pricing-heading">
        <h2 id="pricing-heading">Pricing (₹, excluding GST)</h2>
        <p className="admin-image-disclaimer">
          This store sells {salesMode === "wholesale" ? "wholesale: shoppers see the wholesale price, MOQ and quantity tiers" : "retail: shoppers see the retail price and buy single pieces"}.
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
        <h2 id="variants-heading">Colours &amp; stock</h2>
        {draft.variants.length === 0 ? (
          <div className="admin-form-grid">
            <label className="admin-field">
              Stock (pieces)
              <input type="number" min={0} step={1} value={draft.stockQuantity} onChange={(event) => set("stockQuantity", event.currentTarget.value)} />
            </label>
          </div>
        ) : (
          <p className="admin-image-disclaimer">Total stock across colours: {totalVariantStock} pieces.</p>
        )}
        {error("variants")}
        {draft.variants.map((variant, index) => (
          <fieldset key={variant.key} className="admin-repeater admin-variant">
            <legend>Colour {index + 1}</legend>
            <div className="admin-repeater__row">
              {attributes.color.length > 0 ? (
                <label className="admin-field">
                  Colour
                  <select
                    value={variant.colorName}
                    onChange={(event) => {
                      const option = attributes.color.find((entry) => entry.label === event.currentTarget.value);
                      setVariant(variant.key, { colorName: event.currentTarget.value, colorHex: option?.hex || variant.colorHex });
                    }}
                  >
                    <option value="">Choose</option>
                    {attributes.color.map((option) => <option key={option.label} value={option.label}>{option.label}</option>)}
                  </select>
                </label>
              ) : (
                <label className="admin-field">
                  Colour name
                  <input maxLength={60} value={variant.colorName} onChange={(event) => setVariant(variant.key, { colorName: event.currentTarget.value })} />
                </label>
              )}
              <label className="admin-field">
                Swatch
                <input type="color" value={variant.colorHex} onChange={(event) => setVariant(variant.key, { colorHex: event.currentTarget.value })} />
              </label>
              <label className="admin-field">
                SKU
                <input maxLength={64} value={variant.sku} onChange={(event) => setVariant(variant.key, { sku: event.currentTarget.value.toUpperCase() })} />
                {error(`variants.${index}.sku`)}
              </label>
              <label className="admin-field">
                Stock
                <input type="number" min={0} step={1} value={variant.stockQuantity} onChange={(event) => setVariant(variant.key, { stockQuantity: event.currentTarget.value })} />
              </label>
              <button type="button" className="icon-button" aria-label={`Remove colour ${index + 1}`} onClick={() => set("variants", draft.variants.filter((entry) => entry.key !== variant.key))}>
                <Trash2 size={15} />
              </button>
            </div>
            {error(`variants.${index}.colorName`)}
            {cloudinaryEnabled ? (
              <ImageUploader
                images={variant.images}
                onChange={(images: ManagedImage[]) => setVariant(variant.key, { images })}
                fabric={draft.fabric}
                maxImages={12}
              />
            ) : null}
          </fieldset>
        ))}
        <button
          type="button"
          className="text-button"
          onClick={() =>
            set("variants", [
              ...draft.variants,
              { key: draftKey(), colorName: "", colorHex: "#999999", sku: `${draft.sku}-${draft.variants.length + 1}`, stockQuantity: "0", images: [] },
            ])
          }
        >
          <Plus size={14} aria-hidden="true" /> Add colour
        </button>
      </section>

      <section className="admin-form-section" aria-labelledby="images-heading">
        <h2 id="images-heading">Photos</h2>
        {cloudinaryEnabled ? (
          <ImageUploader images={draft.images} onChange={(images) => set("images", images)} productId={draft.id} fabric={draft.fabric} />
        ) : (
          <p className="admin-image-disclaimer">Image uploads need Cloudinary (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and server credentials).</p>
        )}
      </section>

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
