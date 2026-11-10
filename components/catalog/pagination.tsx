import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { catalogHref } from "@/features/catalog/query-string";
import type { CatalogQuery } from "@/features/catalog/types";

/** Numbered pagination: first, last, and the neighbours of the current page. */
export default function Pagination({ basePath, query, pageCount }: {
  basePath: string;
  query: CatalogQuery;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;
  const current = query.page;
  const pages = [...new Set([1, current - 1, current, current + 1, pageCount])]
    .filter((page) => page >= 1 && page <= pageCount)
    .sort((left, right) => left - right);

  return (
    <nav className="catalog-pagination" aria-label="Pagination">
      {current > 1 ? (
        <Link className="catalog-pagination__step" href={catalogHref(basePath, query, { page: current - 1 })} rel="prev">
          <ChevronLeft size={16} aria-hidden="true" /> Previous
        </Link>
      ) : null}
      {pages.map((page, index) => (
        <span key={page} className="catalog-pagination__item">
          {index > 0 && page - pages[index - 1] > 1 ? <span className="catalog-pagination__gap" aria-hidden="true">…</span> : null}
          {page === current ? (
            <span aria-current="page">{page}</span>
          ) : (
            <Link href={catalogHref(basePath, query, { page })} aria-label={`Page ${page}`}>{page}</Link>
          )}
        </span>
      ))}
      {current < pageCount ? (
        <Link className="catalog-pagination__step" href={catalogHref(basePath, query, { page: current + 1 })} rel="next">
          Next <ChevronRight size={16} aria-hidden="true" />
        </Link>
      ) : null}
    </nav>
  );
}
