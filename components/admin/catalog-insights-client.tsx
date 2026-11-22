"use client";

import { useState, type FocusEvent, type PointerEvent } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, PackageX } from "lucide-react";
import AdminCard from "@/components/admin/admin-card";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import AdminStatusChip from "@/components/admin/admin-status-chip";
import StatCard from "@/components/admin/stat-card";
import ErrorCard from "@/components/ui/feedback/error-card";
import NoticeCard from "@/components/ui/feedback/notice-card";
import Select, { type SelectOption } from "@/components/ui/form/select";
import { apiRequest } from "@/lib/api/api-client";
import { formatDate, formatNumber, formatRupees } from "@/lib/format";

export type CatalogInsights = {
  days: number;
  since: string;
  salesMode: "wholesale" | "retail";
  lowStockThreshold: number;
  types: { id: string; name: string; isActive: boolean }[];
  summary: { unitsSold: number; salesValue: number; unitsOnHand: number; stockValue: number; sellThrough: number; outOfStockVariants: number };
  byType: {
    id: string;
    name: string;
    isActive: boolean;
    products: number;
    listed: number;
    variants: number;
    outOfStockVariants: number;
    unitsOnHand: number;
    stockValue: number;
    unitsSold: number;
    salesValue: number;
    sellThrough: number;
    weeksOfCover: number | null;
    views: number;
    carts: number;
    cartRate: number;
  }[];
  sizeCurves: {
    typeId: string;
    typeName: string;
    optionName: string;
    totalSold: number;
    totalStock: number;
    readable: boolean;
    sizes: {
      size: string;
      unitsSold: number;
      soldShare: number;
      stock: number;
      stockShare: number;
      gap: number;
      stockouts: number;
      variants: number;
      call: "reorder" | "overstocked" | "balanced" | "none";
    }[];
  }[];
  restock: {
    productId: string;
    productName: string;
    slug: string;
    typeName: string;
    variantId: string;
    variantTitle: string;
    sku: string;
    stock: number;
    unavailable: boolean;
    unitsSold: number;
    views: number;
  }[];
  deadStock: { productId: string; productName: string; slug: string; stock: number; stockValue: number; listedSince: string }[];
};

const PERIOD_OPTIONS: SelectOption[] = [
  { id: "7", label: "Last 7 days" },
  { id: "30", label: "Last 30 days" },
  { id: "90", label: "Last 90 days" },
  { id: "365", label: "Last 12 months" },
];

/** Sell-through as a meter: one ratio per row against 100%, fill and track from one ramp. */
function Meter({ value, label }: { value: number; label: string }) {
  return (
    <span className="insight-meter" role="img" aria-label={`${label}: ${value}%`}>
      <span className="insight-meter__track">
        <span className="insight-meter__fill" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </span>
      <span className="insight-meter__figure">{value}%</span>
    </span>
  );
}

type Tip = { text: string; x: number; y: number } | null;

/** Weeks the stock lasts at the period's sales rate, in words beyond a couple of years. */
function coverText(weeks: number | null) {
  if (weeks === null) return "No sales";
  if (weeks < 1) return "Under a week";
  if (weeks > 104) return "2+ years";
  return `${formatNumber(Math.round(weeks * 10) / 10)} weeks`;
}

const CALLS = {
  reorder: { label: "Reorder", tone: "warning" as const, icon: AlertTriangle },
  overstocked: { label: "Overstocked", tone: "neutral" as const, icon: PackageX },
  balanced: { label: "Balanced", tone: "success" as const, icon: CheckCircle2 },
};

/**
 * One type's size curve: for each size, its share of units sold (blue) against
 * its share of stock (orange), on one 0–100% scale. Every figure is also in the
 * row, so the bars never gate a value; hover or focus a bar for its readout.
 */
function SizeCurve({ curve }: { curve: CatalogInsights["sizeCurves"][number] }) {
  const [tip, setTip] = useState<Tip>(null);
  const scale = Math.max(10, ...curve.sizes.flatMap((size) => [size.soldShare, size.stockShare]));
  const show = (text: string) => (event: PointerEvent<HTMLSpanElement> | FocusEvent<HTMLSpanElement>) => {
    const host = event.currentTarget.closest(".insight-curve") as HTMLElement | null;
    const box = event.currentTarget.getBoundingClientRect();
    const origin = host?.getBoundingClientRect();
    const x = "clientX" in event ? event.clientX : box.right;
    setTip({ text, x: x - (origin?.left ?? 0), y: box.top - (origin?.top ?? 0) });
  };
  const reorder = curve.sizes.filter((size) => size.call === "reorder");

  return (
    <section className="insight-curve" aria-labelledby={`curve-${curve.typeId}`}>
      <header className="insight-curve__head">
        <h3 id={`curve-${curve.typeId}`}>
          {curve.typeName} · {curve.optionName}
        </h3>
        <ul className="insight-legend" aria-label="Legend">
          <li><span className="insight-legend__key is-sold" aria-hidden="true" /> Share of units sold</li>
          <li><span className="insight-legend__key is-stock" aria-hidden="true" /> Share of stock</li>
        </ul>
      </header>
      {!curve.readable ? (
        <p className="admin-image-disclaimer">
          {formatNumber(curve.totalSold)} units sold in this period: the curve is read from {formatNumber(10)} or more. Stock shares are shown meanwhile.
        </p>
      ) : reorder.length ? (
        <p className="insight-curve__lead">
          Sells faster than it&apos;s stocked: <strong>{reorder.map((size) => size.size).join(", ")}</strong>. Buy the next run in the “sold” shares below.
        </p>
      ) : null}
      <div className="admin-table-wrap is-flush">
        <table className="admin-table insight-curve__table">
          <thead>
            <tr>
              <th scope="col">{curve.optionName}</th>
              <th scope="col" className="insight-curve__bars-head">Sold vs stock</th>
              <th scope="col" className="is-numeric">Sold</th>
              <th scope="col" className="is-numeric">In stock</th>
              <th scope="col" className="is-numeric">Gap</th>
              <th scope="col">Sold out</th>
              <th scope="col">Call</th>
            </tr>
          </thead>
          <tbody>
            {curve.sizes.map((size) => {
              const call = size.call === "none" ? null : CALLS[size.call];
              const soldText = `${size.size} · ${size.soldShare}% of units sold (${formatNumber(size.unitsSold)})`;
              const stockText = `${size.size} · ${size.stockShare}% of stock (${formatNumber(size.stock)})`;
              return (
                <tr key={size.size}>
                  <td><strong>{size.size}</strong></td>
                  <td className="insight-curve__bars">
                    <span
                      className="insight-bar is-sold"
                      style={{ width: `${(size.soldShare / scale) * 100}%` }}
                      tabIndex={0}
                      aria-label={soldText}
                      onPointerEnter={show(soldText)}
                      onPointerMove={show(soldText)}
                      onPointerLeave={() => setTip(null)}
                      onFocus={show(soldText)}
                      onBlur={() => setTip(null)}
                    />
                    <span
                      className="insight-bar is-stock"
                      style={{ width: `${(size.stockShare / scale) * 100}%` }}
                      tabIndex={0}
                      aria-label={stockText}
                      onPointerEnter={show(stockText)}
                      onPointerMove={show(stockText)}
                      onPointerLeave={() => setTip(null)}
                      onFocus={show(stockText)}
                      onBlur={() => setTip(null)}
                    />
                  </td>
                  <td className="is-numeric">{size.soldShare}% <small className="admin-cell-sub">{formatNumber(size.unitsSold)} pcs</small></td>
                  <td className="is-numeric">{size.stockShare}% <small className="admin-cell-sub">{formatNumber(size.stock)} pcs</small></td>
                  <td className="is-numeric">{size.gap > 0 ? "+" : ""}{size.gap} pts</td>
                  <td>{size.variants ? `${formatNumber(size.stockouts)} of ${formatNumber(size.variants)}` : "—"}</td>
                  <td>{call ? <AdminStatusChip status={size.call} label={call.label} tone={call.tone} /> : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {tip ? (
        <div className="insight-tooltip" role="tooltip" style={{ left: tip.x, top: tip.y }}>
          {tip.text}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Admin → Catalogue insights: sales, stock and demand by product type, the
 * size curve of every sized type, what to restock first and what isn't selling.
 * The first view arrives with the page; changing a filter keeps the current
 * figures on screen (dimmed) until the new ones arrive.
 */
export default function CatalogInsightsClient({ initial }: { initial: CatalogInsights }) {
  const [data, setData] = useState(initial);
  const [days, setDays] = useState(String(initial.days));
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const wholesale = data.salesMode === "wholesale";

  async function load(nextDays: string, nextType: string) {
    setDays(nextDays);
    setType(nextType);
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ days: nextDays, ...(nextType ? { type: nextType } : {}) });
      const result = await apiRequest<CatalogInsights>(`/api/v1/admin/insights/catalog?${params}`);
      if (result.data) setData(result.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load insights.");
    } finally {
      setLoading(false);
    }
  }

  const typeOptions: SelectOption[] = [{ id: "", label: "All product types" }, ...data.types.map((entry) => ({ id: entry.id, label: `${entry.name}${entry.isActive ? "" : " (off)"}` }))];
  const { summary } = data;

  return (
    <>
      <AdminPageHeading
        eyebrow="Catalogue"
        title="Catalogue insights"
        description="How each product type sells and how its stock is placed. Sales are paid, uncancelled order lines before GST and shipping; views and cart adds come from shopper activity."
      />
      <div className="insight-filters" role="group" aria-label="Filters">
        <Select label="Period" hideLabel options={PERIOD_OPTIONS} value={days} onChange={(value) => void load(value, type)} />
        {data.types.length > 1 ? <Select label="Product type" hideLabel options={typeOptions} value={type} onChange={(value) => void load(days, value)} /> : null}
        <span className="admin-field-hint">Since {formatDate(data.since)}</span>
      </div>
      {error ? <ErrorCard title="Unable to load insights" description={error} /> : null}

      <div className={loading ? "admin-stack insight-body is-loading" : "admin-stack insight-body"} aria-busy={loading}>
        <section className="admin-stat-grid" aria-label="Headline figures">
          <StatCard label="Units sold" value={formatNumber(summary.unitsSold)} detail={`${wholesale ? "Pieces" : "Items"} in paid orders`} />
          <StatCard label="Sales value" value={formatRupees(summary.salesValue, { compact: true })} detail="Before GST and shipping" />
          <StatCard label="Sell-through" value={`${summary.sellThrough}%`} detail="Sold ÷ (sold + still in stock)" />
          <StatCard label="In stock" value={formatNumber(summary.unitsOnHand)} detail={`Worth ${formatRupees(summary.stockValue, { compact: true })} at ${wholesale ? "wholesale" : "retail"} price`} />
          <StatCard label="Sold-out variants" value={formatNumber(summary.outOfStockVariants)} detail="Sizes and colours at zero stock" />
        </section>

        <AdminCard title="By product type" description="Stock lasts: how long the stock would last at this period's sales rate.">
          {data.byType.length ? (
            <div className="admin-table-wrap is-flush">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Type</th>
                    <th scope="col" className="is-numeric">Units sold</th>
                    <th scope="col" className="is-numeric">Sales</th>
                    <th scope="col">Sell-through</th>
                    <th scope="col" className="is-numeric">Stock lasts</th>
                    <th scope="col" className="is-numeric">In stock</th>
                    <th scope="col" className="is-numeric">Sold out</th>
                    <th scope="col" className="is-numeric">Views → cart</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byType.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.id !== "none" ? <Link href={`/admin/product-types/${row.id}`}>{row.name}</Link> : row.name}</strong>
                        <small className="admin-cell-sub">
                          {formatNumber(row.listed)} of {formatNumber(row.products)} products listed{row.isActive ? "" : " · off sale"}
                        </small>
                      </td>
                      <td className="is-numeric">{formatNumber(row.unitsSold)}</td>
                      <td className="is-numeric">{formatRupees(row.salesValue, { compact: true })}</td>
                      <td>
                        <Meter value={row.sellThrough} label={`${row.name} sell-through`} />
                      </td>
                      <td className="is-numeric">{coverText(row.weeksOfCover)}</td>
                      <td className="is-numeric">
                        {formatNumber(row.unitsOnHand)}
                        <small className="admin-cell-sub">{formatRupees(row.stockValue, { compact: true })}</small>
                      </td>
                      <td className="is-numeric">{formatNumber(row.outOfStockVariants)} <small className="admin-cell-sub">of {formatNumber(row.variants)}</small></td>
                      <td className="is-numeric">
                        {row.cartRate}% <small className="admin-cell-sub">{formatNumber(row.carts)} of {formatNumber(row.views)} views</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-empty-results" role="status">No products yet.</div>
          )}
        </AdminCard>

        {data.sizeCurves.length ? (
          <AdminCard
            title="Size curve"
            description="Each size's share of units sold against its share of stock. Sizes that sell more than they hold run out first; sizes that hold more than they sell tie up money. Gaps of 5 points or more are called out."
          >
            <div className="admin-stack">
              {data.sizeCurves.map((curve) => (
                <SizeCurve key={curve.typeId} curve={curve} />
              ))}
            </div>
          </AdminCard>
        ) : null}

        <div className="admin-detail-grid">
          <AdminCard title="Restock first" description={`Variants shoppers can't buy, or with ${formatNumber(data.lowStockThreshold)} or fewer left, most wanted first.`}>
            {data.restock.length ? (
              <div className="admin-table-wrap is-flush">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Product</th>
                      <th scope="col" className="is-numeric">Stock</th>
                      <th scope="col" className="is-numeric">Sold</th>
                      <th scope="col" className="is-numeric">Views</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.restock.map((row) => (
                      <tr key={`${row.productId}:${row.variantId}`}>
                        <td>
                          <strong><Link href={`/admin/products/${row.productId}/edit`}>{row.productName}</Link></strong>
                          <small className="admin-cell-sub">{[row.variantTitle, row.sku].filter(Boolean).join(" · ")}</small>
                        </td>
                        <td className="is-numeric">{formatNumber(row.stock)}</td>
                        <td className="is-numeric">{formatNumber(row.unitsSold)}</td>
                        <td className="is-numeric">{formatNumber(row.views)}</td>
                        <td>
                          <AdminStatusChip status={row.unavailable ? "unavailable" : "low"} label={row.unavailable ? "Can't be bought" : "Low"} tone={row.unavailable ? "danger" : "warning"} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <NoticeCard tone="success" title="Nothing to restock" description="No variant is unavailable or below the low-stock alert." />
            )}
          </AdminCard>

          <AdminCard title="Not selling" description="Listed before this period, with stock, and no sale in it. Most money tied up first.">
            {data.deadStock.length ? (
              <ul className="admin-ranked-list">
                {data.deadStock.map((row) => (
                  <li key={row.productId}>
                    <span>
                      <Link href={`/admin/products/${row.productId}/edit`}>{row.productName}</Link>
                      <small className="admin-cell-sub">
                        {formatNumber(row.stock)} in stock · listed {formatDate(row.listedSince)}
                      </small>
                    </span>
                    <strong>{formatRupees(row.stockValue, { compact: true })}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <NoticeCard tone="success" title="Everything sold at least once" description="Every product listed before this period had a sale in it." />
            )}
          </AdminCard>
        </div>
      </div>
    </>
  );
}
