"use client";

import { useState } from "react";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import AdminCard from "@/components/admin/admin-card";
import LoadingButton from "@/components/ui/buttons/loading-button";
import ErrorCard from "@/components/ui/feedback/error-card";
import Select, { type SelectOption } from "@/components/ui/form/select";
import TableSkeleton from "@/components/ui/loaders/table-skeleton";
import { useApiRequest } from "@/hooks/use-api-request";
import { formatNumber } from "@/lib/format";

const PERIOD_OPTIONS: SelectOption[] = [
  { id: "7", label: "Last 7 days" },
  { id: "30", label: "Last 30 days" },
  { id: "90", label: "Last 90 days" },
];

type Ranked = { target: string; label: string; count: number };
type Insights = {
  days: number;
  sections: { key: string; label: string; enabled: boolean; views: number; clicks: number; clickRate: number | null }[];
  topBanners: Ranked[];
  topCategories: Ranked[];
  topProducts: Ranked[];
  actions: Record<"searches" | "suggestionClicks" | "wishlistAdds" | "cartAdds" | "feedLoads" | "newsletterSignups", number>;
};

const ACTION_LABELS: Record<keyof Insights["actions"], string> = {
  searches: "Searches",
  suggestionClicks: "Search suggestion clicks",
  wishlistAdds: "Wishlist adds",
  cartAdds: "Add to cart",
  feedLoads: "Feed pages loaded",
  newsletterSignups: "Newsletter sign-ups",
};

function RankedList({ title, rows, empty }: { title: string; rows: Ranked[]; empty: string }) {
  return (
    <AdminCard title={title}>
      {rows.length ? (
        <ol className="admin-ranked-list">
          {rows.map((row) => (
            <li key={row.target}>
              <span>{row.label}</span>
              <strong>{formatNumber(row.count)}</strong>
            </li>
          ))}
        </ol>
      ) : (
        <div className="admin-empty-results" role="status">{empty}</div>
      )}
    </AdminCard>
  );
}

/** Home page performance from first-party, aggregate-only analytics. */
export default function AdminAnalyticsClient() {
  const [days, setDays] = useState(30);
  const { loading, error, data, refetch } = useApiRequest<Insights>(`/api/v1/admin/analytics?days=${days}`);

  return (
    <>
      <AdminPageHeading
        eyebrow="Marketing"
        title="Home page insights"
        description="How shoppers use the home page: which rows they see and click, and what they do next. Counts only; no visitor is tracked individually."
        action={
          <div className="admin-heading-actions">
            <Select label="Period" hideLabel options={PERIOD_OPTIONS} value={String(days)} onChange={(id) => setDays(Number(id))} />
          </div>
        }
      />
      {error ? <ErrorCard title="Unable to load insights" description={error} action={<LoadingButton onClick={() => void refetch()}>Retry</LoadingButton>} /> : null}
      {loading && !data ? (
        <TableSkeleton rows={8} />
      ) : data ? (
        <div className="admin-stack">
          <div className="admin-newsletter-stats" role="group" aria-label="Shopper actions">
            {(Object.keys(ACTION_LABELS) as (keyof Insights["actions"])[]).map((key) => (
              <div key={key}>
                <strong>{formatNumber(data.actions[key])}</strong>
                <span>{ACTION_LABELS[key]}</span>
              </div>
            ))}
          </div>
          <AdminCard title="Sections" description="Views count each time a row is scrolled into view; clicks are links followed inside it.">
            <div className="admin-table-wrap is-flush">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Section</th>
                    <th scope="col" className="is-numeric">Views</th>
                    <th scope="col" className="is-numeric">Clicks</th>
                    <th scope="col" className="is-numeric">Click rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sections.map((section) => (
                    <tr key={section.key}>
                      <td>{section.label}{section.enabled ? "" : " (hidden)"}</td>
                      <td className="is-numeric">{formatNumber(section.views)}</td>
                      <td className="is-numeric">{formatNumber(section.clicks)}</td>
                      <td className="is-numeric">{section.clickRate === null ? "—" : `${section.clickRate}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminCard>
          <div className="admin-detail-grid">
            <RankedList title="Top banners" rows={data.topBanners} empty="No banner clicks yet." />
            <RankedList title="Top categories" rows={data.topCategories} empty="No category clicks yet." />
          </div>
          <RankedList title="Most clicked products" rows={data.topProducts} empty="No product clicks yet." />
        </div>
      ) : null}
    </>
  );
}
