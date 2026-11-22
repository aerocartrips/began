"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import AdminCard from "@/components/admin/admin-card";
import LoadingButton from "@/components/ui/buttons/loading-button";
import NoticeCard from "@/components/ui/feedback/notice-card";
import ProductTypeIcon from "@/components/catalog/product-type-icon";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { sendJson } from "@/lib/api/send-json";
import { formatNumber } from "@/lib/format";
import type { ProductTypesPayload } from "@/features/products/catalog-setup";

type Choice = {
  /** "type:<id>" for a type the store has, "template:<key>" for one to add. */
  id: string;
  name: string;
  icon: string;
  description: string;
  detail: string;
  products: number;
};

/**
 * Store settings → What you sell: one switch per kind of product. Ticked kinds
 * are on sale (new ones are created from their templates), unticked ones are
 * hidden from the storefront with all their products, which come back as
 * they were when the kind is ticked again. Change it whenever the store does.
 */
export default function SellingSetup({ types, templates, untypedCount }: ProductTypesPayload) {
  const router = useRouter();
  const feedback = useFeedback();
  const installed = new Set(types.map((type) => type.template).filter(Boolean));
  const choices: Choice[] = [
    ...types.map((type) => ({
      id: `type:${type.id}`,
      name: type.pluralName,
      icon: type.icon,
      description: type.description,
      detail: `${formatNumber(type.productCount)} products`,
      products: type.productCount,
    })),
    ...templates
      .filter((template) => template.key !== "custom" && !installed.has(template.key))
      .map((template) => ({
        id: `template:${template.key}`,
        name: template.pluralName,
        icon: template.icon,
        description: template.description,
        detail: [template.options.length ? template.options.join(" × ") : "", template.hasSizeChart ? "size guide" : ""].filter(Boolean).join(" · ") || "New",
        products: 0,
      })),
  ];
  const initial = new Set(types.filter((type) => type.isActive).map((type) => `type:${type.id}`));
  const [selected, setSelected] = useState(initial);
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const hiding = choices.filter((choice) => initial.has(choice.id) && !selected.has(choice.id));
  const adding = choices.filter((choice) => choice.id.startsWith("template:") && selected.has(choice.id));
  const showing = choices.filter((choice) => choice.id.startsWith("type:") && !initial.has(choice.id) && selected.has(choice.id));
  const changed = hiding.length + adding.length + showing.length > 0;
  const hiddenProducts = hiding.reduce((total, choice) => total + choice.products, 0);

  async function save() {
    setSaving(true);
    try {
      await sendJson("/api/v1/admin/product-types/selling", "PUT", {
        typeIds: [...selected].filter((id) => id.startsWith("type:")).map((id) => id.slice(5)),
        templates: [...selected].filter((id) => id.startsWith("template:")).map((id) => id.slice(9)),
      });
      feedback.success("Storefront updated", `Selling ${[...selected].length} ${[...selected].length === 1 ? "kind" : "kinds"} of product.`);
      router.refresh();
    } catch (error) {
      feedback.error("Not saved", error instanceof Error ? error.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminCard
      title="What you sell"
      description="Tick everything your store sells: one kind, several or all. The storefront, navigation, filters and the product form follow your choice, and you can change it at any time."
      action={
        <div className="admin-heading-actions">
          <button type="button" className="text-button" onClick={() => setSelected(new Set(choices.map((choice) => choice.id)))}>Select all</button>
          <button type="button" className="text-button" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      }
    >
      {untypedCount > 0 ? (
        <NoticeCard
          tone="warning"
          title={`${formatNumber(untypedCount)} products don't have a type yet`}
          description="Upgrade them on the Product types page first, so they are counted as sarees here."
          action={<Link className="button button-glass button-sm" href="/admin/product-types">Product types</Link>}
        />
      ) : null}

      <ul className="admin-selling-grid">
        {choices.map((choice) => {
          const on = selected.has(choice.id);
          return (
            <li key={choice.id}>
              <label className={on ? "admin-selling-card is-on" : "admin-selling-card"}>
                <input type="checkbox" checked={on} onChange={() => toggle(choice.id)} />
                <span className="admin-type-list__icon">
                  <ProductTypeIcon icon={choice.icon} size={20} />
                </span>
                <span className="admin-selling-card__copy">
                  <strong>{choice.name}</strong>
                  <small>{choice.detail}</small>
                </span>
                <span className="admin-selling-card__check" aria-hidden="true">
                  {on ? <Check size={14} strokeWidth={2.4} /> : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="admin-form-actions">
        <small className="admin-field-hint">
          {!selected.size
            ? "Choose at least one kind of product to sell."
            : changed
              ? [
                  adding.length ? `Adds ${adding.map((choice) => choice.name).join(", ")}` : "",
                  showing.length ? `puts ${showing.map((choice) => choice.name).join(", ")} back on sale` : "",
                  hiding.length ? `hides ${hiding.map((choice) => choice.name).join(", ")}${hiddenProducts ? ` (${formatNumber(hiddenProducts)} products)` : ""}` : "",
                ]
                  .filter(Boolean)
                  .join("; ")
              : "No changes."}
        </small>
        <Link className="text-button" href="/admin/product-types">Edit types and size guides</Link>
        <LoadingButton type="button" size="sm" loading={saving} disabled={!changed || !selected.size} onClick={() => void save()}>
          Save what you sell
        </LoadingButton>
      </div>
    </AdminCard>
  );
}
