"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Monitor, Plus, Smartphone, X } from "lucide-react";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import AdminCard from "@/components/admin/admin-card";
import AdminStatusChip from "@/components/admin/admin-status-chip";
import LoadingButton from "@/components/ui/buttons/loading-button";
import Combobox from "@/components/ui/form/combobox";
import ErrorCard from "@/components/ui/feedback/error-card";
import TableSkeleton from "@/components/ui/loaders/table-skeleton";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { useApiRequest } from "@/hooks/use-api-request";
import { apiRequest } from "@/lib/api/api-client";
import { sendJson } from "@/lib/api/send-json";
import { formatDateTime } from "@/lib/format";
import { HOME_SECTION_META, MAX_COLLECTIONS, PRODUCT_TAB_KEYS, PRODUCT_TAB_LABELS, TRUST_ICONS } from "@/lib/constants/homepage";
import type { AdminHomepageLayout, CollectionSource, HomeSection, ProductTabKey, TrustItem } from "@/features/homepage/types";

type CategoryOption = { _id: string; name: string; slug: string };
type ProductOption = { id: string; name: string; sku?: string };

/** Sections that show a product row, and so take a product count and "View all" link. */
const PRODUCT_ROWS = new Set(["for-you", "product-tabs", "collection", "recently-viewed", "reviews", "guides"]);
/** Sections with no visible heading of their own. */
const NO_HEADING = new Set(["category-nav", "hero", "trust"]);
const SOURCE_LABELS: Record<CollectionSource["kind"], string> = {
  category: "Category",
  fabric: "Fabric",
  weave: "Weave",
  occasion: "Occasion",
  products: "Hand-picked products",
};

const meta = (section: HomeSection) => HOME_SECTION_META[section.type] ?? { label: section.type, help: "" };

function newCollection(): HomeSection {
  return {
    key: `collection-${Math.random().toString(36).slice(2, 10)}`,
    type: "collection",
    enabled: true,
    title: "",
    description: "",
    limit: 10,
    viewAllHref: "",
    showOnMobile: true,
    showOnDesktop: true,
    source: { kind: "category", value: "", productIds: [], sort: "popular" },
  };
}

/* ---------------------------------------------------------------- product picker */

function ProductPicker({ ids, onChange }: { ids: string[]; onChange: (ids: string[]) => void }) {
  const [names, setNames] = useState<Record<string, string>>({});
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<ProductOption[]>([]);
  const [searching, setSearching] = useState(false);
  const missing = ids.filter((id) => !names[id]).join(",");

  // Names for products already picked (current, active products only).
  useEffect(() => {
    if (!missing) return;
    const controller = new AbortController();
    apiRequest<{ id: string; name: string }[]>(`/api/v1/catalog/products?ids=${missing}`, { signal: controller.signal })
      .then((result) => setNames((current) => ({ ...current, ...Object.fromEntries((result.data ?? []).map((item) => [item.id, item.name])) })))
      .catch(() => undefined);
    return () => controller.abort();
  }, [missing]);

  useEffect(() => {
    const query = term.trim();
    if (query.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      apiRequest<{ _id: string; name: string; sku: string }[]>(
        `/api/v1/products?${new URLSearchParams({ search: query, status: "active", limit: "8" })}`,
        { signal: controller.signal },
      )
        .then((result) => setResults((result.data ?? []).map((item) => ({ id: item._id, name: item.name, sku: item.sku }))))
        .catch(() => undefined)
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  return (
    <div className="admin-field admin-field-wide">
      <span>Products ({ids.length})</span>
      {ids.length ? (
        <ol className="admin-home-picked">
          {ids.map((id, index) => (
            <li key={id}>
              <span>{names[id] ?? "Unavailable product"}</span>
              <button type="button" className="icon-button" aria-label={`Remove ${names[id] ?? "product"}`} onClick={() => onChange(ids.filter((_, position) => position !== index))}>
                <X size={14} />
              </button>
            </li>
          ))}
        </ol>
      ) : null}
      <Combobox
        label={<span className="sr-only">Add a product</span>}
        placeholder={ids.length >= 24 ? "24 products maximum" : "Search products by name or SKU"}
        disabled={ids.length >= 24}
        emptyText={term.trim().length < 2 ? "Type at least 2 characters" : "No active products match"}
        options={(term.trim().length >= 2 ? results : []).map((product) => ({
          id: product.id,
          label: product.name,
          description: product.sku,
          disabled: ids.includes(product.id),
        }))}
        value=""
        onChange={(id) => {
          const product = results.find((item) => item.id === id);
          if (!product) return;
          setNames((current) => ({ ...current, [product.id]: product.name }));
          onChange([...ids, product.id]);
          setTerm("");
        }}
        search={{ value: term, onChange: setTerm, loading: searching }}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- section editor */

function SectionEditor({ section, categories, onChange }: {
  section: HomeSection;
  categories: CategoryOption[];
  onChange: (patch: Partial<HomeSection>) => void;
}) {
  const source = section.source ?? { kind: "category" as const, value: "", productIds: [], sort: "popular" as const };
  const setSource = (patch: Partial<CollectionSource>) => onChange({ source: { ...source, ...patch } });
  const items = section.items ?? [];
  const setItem = (index: number, patch: Partial<TrustItem>) => onChange({ items: items.map((item, position) => (position === index ? { ...item, ...patch } : item)) });

  return (
    <div className="admin-form-grid admin-home-editor">
      {!NO_HEADING.has(section.type) ? (
        <>
          <label className="admin-field">
            Heading
            <input value={section.title} maxLength={80} placeholder={section.type === "cta" ? "Uses the default for your store" : ""} onChange={(event) => onChange({ title: event.currentTarget.value })} />
          </label>
          <label className="admin-field">
            Short line under the heading
            <input value={section.description} maxLength={240} onChange={(event) => onChange({ description: event.currentTarget.value })} />
          </label>
        </>
      ) : null}

      {PRODUCT_ROWS.has(section.type) ? (
        <label className="admin-field">
          {section.type === "reviews" ? "Reviews to show" : section.type === "guides" ? "Guides to show" : "Products to show"}
          <input type="number" min={4} max={24} value={section.limit} onChange={(event) => onChange({ limit: Math.min(24, Math.max(4, Number(event.currentTarget.value) || 4)) })} />
        </label>
      ) : null}
      {["for-you", "catalogue", "collection", "guides", "feed"].includes(section.type) ? (
        <label className="admin-field">
          &ldquo;View all&rdquo; link (optional)
          <input value={section.viewAllHref} maxLength={2048} placeholder="/products?sort=popular" onChange={(event) => onChange({ viewAllHref: event.currentTarget.value })} />
        </label>
      ) : null}

      {section.type === "product-tabs" ? (
        <fieldset className="admin-field admin-field-wide admin-home-checks">
          <legend>Tabs</legend>
          {PRODUCT_TAB_KEYS.map((key) => {
            const tabs = section.tabs ?? (PRODUCT_TAB_KEYS as ProductTabKey[]);
            const checked = tabs.includes(key as ProductTabKey);
            return (
              <label key={key} className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    onChange({ tabs: (PRODUCT_TAB_KEYS as ProductTabKey[]).filter((tab) => (tab === key ? !checked : tabs.includes(tab))) })
                  }
                />
                {PRODUCT_TAB_LABELS[key as ProductTabKey]}
              </label>
            );
          })}
          <small className="admin-field-hint">Best sellers appear once there are paid orders; Trending once products get recent activity.</small>
        </fieldset>
      ) : null}

      {section.type === "collection" ? (
        <>
          <label className="admin-field">
            Products from
            <select value={source.kind} onChange={(event) => setSource({ kind: event.currentTarget.value as CollectionSource["kind"], value: "" })}>
              {Object.entries(SOURCE_LABELS).map(([kind, label]) => (
                <option key={kind} value={kind}>{label}</option>
              ))}
            </select>
          </label>
          {source.kind === "category" ? (
            <Combobox
              className="admin-field"
              label="Category"
              placeholder="Choose a category"
              options={categories.map((category) => ({ id: category.slug, label: category.name }))}
              value={source.value}
              onChange={(value) => setSource({ value })}
            />
          ) : source.kind === "products" ? null : (
            <label className="admin-field">
              {SOURCE_LABELS[source.kind]} (as written on products)
              <input value={source.value} maxLength={120} placeholder={source.kind === "fabric" ? "Silk" : source.kind === "weave" ? "Banarasi" : "Wedding"} onChange={(event) => setSource({ value: event.currentTarget.value })} />
            </label>
          )}
          {source.kind === "products" ? (
            <ProductPicker ids={source.productIds} onChange={(productIds) => setSource({ productIds })} />
          ) : (
            <label className="admin-field">
              Order
              <select value={source.sort} onChange={(event) => setSource({ sort: event.currentTarget.value as CollectionSource["sort"] })}>
                <option value="popular">Most popular</option>
                <option value="newest">Newest</option>
                <option value="price-asc">Lowest price</option>
              </select>
            </label>
          )}
        </>
      ) : null}

      {section.type === "trust" ? (
        <div className="admin-field admin-field-wide">
          <span>Points {items.length ? "" : "(using the defaults for your sales mode)"}</span>
          {items.map((item, index) => (
            <div key={index} className="admin-home-trust-row">
              <select aria-label="Icon" value={item.icon} onChange={(event) => setItem(index, { icon: event.currentTarget.value })}>
                {TRUST_ICONS.map((icon) => (
                  <option key={icon} value={icon}>{icon}</option>
                ))}
              </select>
              <input aria-label="Title" value={item.title} maxLength={60} placeholder="Title" onChange={(event) => setItem(index, { title: event.currentTarget.value })} />
              <input aria-label="Text" value={item.text} maxLength={140} placeholder="One short line" onChange={(event) => setItem(index, { text: event.currentTarget.value })} />
              <button type="button" className="icon-button" aria-label={`Remove ${item.title || "point"}`} onClick={() => onChange({ items: items.filter((_, position) => position !== index) })}>
                <X size={14} />
              </button>
            </div>
          ))}
          {items.length < 6 ? (
            <button type="button" className="text-button" onClick={() => onChange({ items: [...items, { icon: "badge", title: "", text: "" }] })}>
              Add a point
            </button>
          ) : null}
          <small className="admin-field-hint">Only claim what your business can back up. Remove every point to go back to the defaults.</small>
        </div>
      ) : null}

      {section.type === "cta" ? (
        <>
          {(["primaryCta", "secondaryCta"] as const).map((key) => (
            <div key={key} className="admin-field admin-field-wide admin-home-link-row">
              <span>{key === "primaryCta" ? "Main button" : "Second button"}</span>
              <input aria-label="Button label" value={section[key]?.label ?? ""} maxLength={40} placeholder="Label" onChange={(event) => onChange({ [key]: { label: event.currentTarget.value, href: section[key]?.href ?? "" } })} />
              <input aria-label="Button link" value={section[key]?.href ?? ""} maxLength={2048} placeholder="/request-quote" onChange={(event) => onChange({ [key]: { label: section[key]?.label ?? "", href: event.currentTarget.value } })} />
            </div>
          ))}
          <small className="admin-field-hint admin-field-wide">Leave the heading and buttons empty to use the defaults for your sales mode.</small>
        </>
      ) : null}

      {section.type === "guides" ? (
        <p className="admin-field-hint admin-field-wide">
          Write guides in <Link href="/admin/guides">Buying guides</Link>. Only published guides with a cover photo appear here.
        </p>
      ) : null}

      {section.type === "hero" ? (
        <p className="admin-field-hint admin-field-wide">
          Slides are managed in <Link href="/admin/banners">Banners</Link>. Without live banners, the store headline and hero image are shown.
        </p>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- page */

export default function AdminHomepageClient() {
  const feedback = useFeedback();
  const { loading, error, data, refetch } = useApiRequest<AdminHomepageLayout>("/api/v1/admin/homepage");
  const { data: categoryData } = useApiRequest<CategoryOption[]>("/api/v1/categories");
  const [sections, setSections] = useState<HomeSection[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "reset" | null>(null);

  const current = sections ?? data?.sections ?? null;
  const dirty = sections !== null;
  const collections = current?.filter((section) => section.type === "collection").length ?? 0;

  const update = (key: string, patch: Partial<HomeSection>) =>
    setSections((list) => (list ?? data?.sections ?? []).map((section) => (section.key === key ? { ...section, ...patch } : section)));

  function move(index: number, direction: -1 | 1) {
    const list = [...(current ?? [])];
    [list[index], list[index + direction]] = [list[index + direction], list[index]];
    setSections(list);
  }

  async function save() {
    if (!current) return;
    setBusy("save");
    try {
      await sendJson("/api/v1/admin/homepage", "PUT", { sections: current });
      feedback.success("Home page saved", "Changes are live on the storefront.");
      setSections(null);
      await refetch();
    } catch (cause) {
      feedback.error("Not saved", cause instanceof Error ? cause.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  async function reset() {
    if (!window.confirm("Go back to the default home page layout? Your sections and collections will be removed.")) return;
    setBusy("reset");
    try {
      await sendJson("/api/v1/admin/homepage", "DELETE");
      feedback.success("Default layout restored");
      setSections(null);
      await refetch();
    } catch (cause) {
      feedback.error("Not reset", cause instanceof Error ? cause.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <AdminPageHeading
        eyebrow="Marketing"
        title="Home page"
        description="Choose which rows appear on the storefront home page, their order, headings and where they show. Products, prices and stock always come from your catalogue."
        action={
          <div className="admin-heading-actions">
            <LoadingButton type="button" variant="secondary" loading={busy === "reset"} disabled={busy !== null || data?.isDefault} onClick={() => void reset()}>
              Reset to default
            </LoadingButton>
            <LoadingButton type="button" loading={busy === "save"} disabled={!dirty || busy !== null} onClick={() => void save()}>
              Save changes
            </LoadingButton>
          </div>
        }
      />
      {error ? <ErrorCard title="Unable to load the home page layout" description={error} action={<LoadingButton onClick={() => void refetch()}>Retry</LoadingButton>} /> : null}
      {loading && !current ? (
        <TableSkeleton rows={8} />
      ) : current ? (
        <AdminCard
          title="Sections"
          description={
            data?.isDefault
              ? "Your store uses the default layout. Changes apply once you save."
              : data?.updatedAt
                ? `Last saved ${formatDateTime(data.updatedAt)}`
                : undefined
          }
          action={
            <button type="button" className="button button-glass button-sm" disabled={collections >= MAX_COLLECTIONS} onClick={() => {
              const section = newCollection();
              const list = [...current];
              const feedIndex = list.findIndex((entry) => entry.type === "feed");
              list.splice(feedIndex === -1 ? list.length : feedIndex, 0, section);
              setSections(list);
              setOpen(section.key);
            }}>
              <Plus size={14} aria-hidden="true" /> Add collection
            </button>
          }
        >
          <ol className="admin-home-list">
            {current.map((section, index) => {
              const pinned = section.type === "feed";
              const last = index === current.length - 1 || current[index + 1]?.type === "feed";
              const expanded = open === section.key;
              return (
                <li key={section.key} className={`admin-home-row${section.enabled ? "" : " is-off"}`}>
                  <div className="admin-home-row__main">
                    <div className="admin-banner-row__order">
                      <button type="button" className="icon-button" aria-label={`Move ${meta(section).label} up`} disabled={pinned || index === 0} onClick={() => move(index, -1)}>
                        <ArrowUp size={15} />
                      </button>
                      <button type="button" className="icon-button" aria-label={`Move ${meta(section).label} down`} disabled={pinned || last} onClick={() => move(index, 1)}>
                        <ArrowDown size={15} />
                      </button>
                    </div>
                    <div className="admin-home-row__copy">
                      <strong>{section.type === "collection" ? section.title || "New collection" : meta(section).label}</strong>
                      <small>{pinned ? `${meta(section).help}` : section.type === "collection" ? `Collection · ${SOURCE_LABELS[section.source?.kind ?? "category"]}` : meta(section).help}</small>
                    </div>
                    <AdminStatusChip status={section.enabled ? "active" : "draft"} label={section.enabled ? "Shown" : "Hidden"} />
                    <div className="admin-home-row__toggles" role="group" aria-label={`Where ${meta(section).label} shows`}>
                      <button type="button" className="icon-button" aria-pressed={section.showOnMobile} title="Show on phones" aria-label="Show on phones" onClick={() => update(section.key, { showOnMobile: !section.showOnMobile })}>
                        <Smartphone size={15} />
                      </button>
                      <button type="button" className="icon-button" aria-pressed={section.showOnDesktop} title="Show on desktop" aria-label="Show on desktop" onClick={() => update(section.key, { showOnDesktop: !section.showOnDesktop })}>
                        <Monitor size={15} />
                      </button>
                    </div>
                    <div className="admin-product-actions">
                      <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : section.key)}>
                        {expanded ? "Close" : "Edit"}
                      </button>
                      <button type="button" onClick={() => update(section.key, { enabled: !section.enabled })}>
                        {section.enabled ? "Hide" : "Show"}
                      </button>
                      {section.type === "collection" ? (
                        <button type="button" onClick={() => setSections(current.filter((entry) => entry.key !== section.key))}>
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {expanded ? (
                    <SectionEditor section={section} categories={categoryData ?? []} onChange={(patch) => update(section.key, patch)} />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </AdminCard>
      ) : null}
    </>
  );
}
