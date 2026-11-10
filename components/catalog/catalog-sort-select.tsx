"use client";

import { useRouter } from "next/navigation";
import Select, { type SelectOption } from "@/components/ui/form/select";
import { catalogHref } from "@/features/catalog/query-string";
import type { CatalogQuery, CatalogSort } from "@/features/catalog/types";

/**
 * The catalogue's sort, in the toolbar above the results. Picking an order
 * shows its first page with every filter kept. Render it with
 * `key={query.sort}` so back/forward shows the page's own order.
 */
export default function CatalogSortSelect({ basePath, query, options }: {
  basePath: string;
  query: CatalogQuery;
  options: SelectOption[];
}) {
  const router = useRouter();
  return (
    <Select
      className="catalog-sort"
      label="Sort by"
      options={options}
      defaultValue={query.sort}
      onChange={(sort) => router.push(catalogHref(basePath, query, { sort: sort as CatalogSort }), { scroll: false })}
    />
  );
}
