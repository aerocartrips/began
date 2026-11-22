"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Ruler, Wand2 } from "lucide-react";
import AdminCard from "@/components/admin/admin-card";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import AdminStatusChip from "@/components/admin/admin-status-chip";
import LoadingButton from "@/components/ui/buttons/loading-button";
import NoticeCard from "@/components/ui/feedback/notice-card";
import ProductTypeIcon from "@/components/catalog/product-type-icon";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { sendJson } from "@/lib/api/send-json";
import { formatNumber } from "@/lib/format";
import type { AdminAttribute, AdminProductType, ProductTypesPayload } from "@/features/products/catalog-setup";

type Props = ProductTypesPayload & {
  attributes: AdminAttribute[];
  /** Store owners only: the upgrade rebuilds catalogue indexes. */
  canUpgrade: boolean;
};

/** "Colour × Size" for a type's options; "One option" for none. */
function optionSummary(type: AdminProductType, names: Map<string, string>) {
  if (!type.options.length) return "No options (one SKU per product)";
  return type.options.map((option) => names.get(option.key) ?? option.key).join(" × ");
}

/**
 * What the store sells: its product types with an "on sale" switch each (and
 * for all at once), and templates to add more (Saree, T-shirt, Jeans…).
 * Turning a type off hides its products from the storefront until it is back on.
 */
export default function ProductTypesClient({ types, untypedCount, templates, attributes, canUpgrade }: Props) {
  const router = useRouter();
  const feedback = useFeedback();
  const [busy, setBusy] = useState<string | null>(null);
  const names = new Map(attributes.map((attribute) => [attribute.key, attribute.name]));
  const selling = types.filter((type) => type.isActive);
  const existingTemplates = new Set(types.map((type) => type.template).filter(Boolean));

  async function run(key: string, action: () => Promise<unknown>, success: string, then?: (result: unknown) => void) {
    setBusy(key);
    try {
      const result = await action();
      feedback.success(success);
      if (then) then(result);
      else router.refresh();
    } catch (error) {
      feedback.error("Not saved", error instanceof Error ? error.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  const toggle = (type: AdminProductType) =>
    run(
      type.id,
      () => sendJson(`/api/v1/admin/product-types/${type.id}`, "PATCH", { isActive: !type.isActive }),
      type.isActive ? `${type.pluralName} hidden from the storefront` : `${type.pluralName} are on sale`,
    );

  const sellAll = (on: boolean) =>
    run(on ? "all-on" : "all-off", () => sendJson("/api/v1/admin/product-types/selling", "PUT", { typeIds: on ? types.map((type) => type.id) : [] }), on ? "Every product type is on sale" : "Every product type is hidden");

  const addTemplate = (key: string) =>
    run(
      `template:${key}`,
      () => sendJson<AdminProductType>("/api/v1/admin/product-types", "POST", { template: key }),
      "Product type added",
      (result) => {
        const created = (result as { data?: { _id?: string } } | undefined)?.data;
        if (created?._id) router.push(`/admin/product-types/${created._id}`);
        else router.refresh();
      },
    );

  const remove = (type: AdminProductType) =>
    run(`delete:${type.id}`, () => sendJson(`/api/v1/admin/product-types/${type.id}`, "DELETE"), `${type.name} deleted`);

  const upgrade = () => run("upgrade", () => sendJson("/api/v1/admin/product-types/upgrade", "POST"), "Catalogue upgraded");

  return (
    <>
      <AdminPageHeading
        eyebrow="Catalogue"
        title="Product types"
        description="Choose what your store sells. Each type decides the details asked for when you add a product, what shoppers choose (colour, size…) and its size chart."
      />

      {untypedCount > 0 ? (
        <NoticeCard
          tone="warning"
          icon={Wand2}
          title={`${formatNumber(untypedCount)} ${untypedCount === 1 ? "product was" : "products were"} added before product types`}
          description={`Upgrade them to a Saree type: their fabric, weave, occasion, pattern, length and blouse-piece details and their colours carry over, and existing filter links keep working.${canUpgrade ? "" : " A store owner can run the upgrade."}`}
          action={
            canUpgrade ? (
              <LoadingButton type="button" size="sm" loading={busy === "upgrade"} onClick={() => void upgrade()}>
                Upgrade catalogue
              </LoadingButton>
            ) : undefined
          }
        />
      ) : null}

      <AdminCard
        title="What you sell"
        description={
          types.length
            ? `${formatNumber(selling.length)} of ${formatNumber(types.length)} product types on sale. Products of a type that is off are hidden from the storefront, not deleted.`
            : "Add the first thing you sell from a template below."
        }
        action={
          types.length > 1 ? (
            <div className="admin-heading-actions">
              <LoadingButton type="button" size="sm" variant="secondary" loading={busy === "all-off"} disabled={!selling.length} onClick={() => void sellAll(false)}>
                Pause all
              </LoadingButton>
              <LoadingButton type="button" size="sm" loading={busy === "all-on"} disabled={selling.length === types.length} onClick={() => void sellAll(true)}>
                Sell all
              </LoadingButton>
            </div>
          ) : null
        }
      >
        {types.length ? (
          <ul className="admin-type-list">
            {types.map((type) => (
              <li key={type.id} className={type.isActive ? undefined : "is-off"}>
                <span className="admin-type-list__icon">
                  <ProductTypeIcon icon={type.icon} size={20} />
                </span>
                <div className="admin-type-list__copy">
                  <strong>
                    <Link href={`/admin/product-types/${type.id}`}>{type.pluralName}</Link>
                  </strong>
                  <small>
                    {formatNumber(type.productCount)} products · {formatNumber(type.listedCount)} active · {type.fields.length} details · {optionSummary(type, names)}
                    {type.sizeChart ? (
                      <>
                        {" · "}
                        <Ruler size={11} aria-hidden="true" /> size chart
                      </>
                    ) : null}
                  </small>
                </div>
                <AdminStatusChip status={type.isActive ? "active" : "inactive"} label={type.isActive ? "On sale" : "Off"} />
                <label className="account-toggle admin-type-list__switch" title={type.isActive ? "Hide from the storefront" : "Put on sale"}>
                  <span className="sr-only">Sell {type.pluralName}</span>
                  <input type="checkbox" role="switch" checked={type.isActive} disabled={busy !== null} onChange={() => void toggle(type)} />
                  <span className="account-switch" aria-hidden="true" />
                </label>
                <div className="admin-product-actions">
                  <Link href={`/admin/product-types/${type.id}`}>Edit</Link>
                  <Link href={`/admin/products?type=${type.id}`}>Products</Link>
                  {type.productCount === 0 ? (
                    <button type="button" disabled={busy !== null} onClick={() => void remove(type)}>
                      Delete
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="admin-empty-results" role="status">No product types yet.</div>
        )}
      </AdminCard>

      <AdminCard
        title="Add a product type"
        description="Templates come with the usual details, options and a starting size chart for Indian high-street sizing. Change anything afterwards."
      >
        <ul className="admin-template-grid">
          {templates.map((template) => {
            const added = existingTemplates.has(template.key);
            return (
              <li key={template.key} className="admin-template-card">
                <span className="admin-type-list__icon">
                  <ProductTypeIcon icon={template.icon} size={20} />
                </span>
                <div>
                  <h3>{template.pluralName}</h3>
                  <p>{template.description}</p>
                  {template.details.length ? <p className="admin-template-card__meta">Details: {template.details.join(", ")}</p> : null}
                  <p className="admin-template-card__meta">
                    {template.options.length ? `Options: ${template.options.join(" × ")}` : "No options"}
                    {template.hasSizeChart ? " · Size chart" : ""}
                  </p>
                </div>
                <LoadingButton
                  type="button"
                  size="sm"
                  variant={added ? "secondary" : "primary"}
                  loading={busy === `template:${template.key}`}
                  disabled={busy !== null && busy !== `template:${template.key}`}
                  onClick={() => void addTemplate(template.key)}
                >
                  <Plus size={14} aria-hidden="true" /> {added ? "Add another" : "Add"}
                </LoadingButton>
              </li>
            );
          })}
        </ul>
      </AdminCard>
    </>
  );
}
