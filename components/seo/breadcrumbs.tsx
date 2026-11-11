import { Fragment } from "react";
import Link from "next/link";
import JsonLd from "@/components/seo/json-ld";
import { breadcrumbJsonLd, withContext } from "@/lib/seo/structured-data";

export type Crumb = { name: string; href?: string };

/**
 * Breadcrumb navigation and its BreadcrumbList structured data, from one list
 * so search results show the same trail shoppers see. The last crumb is the
 * current page.
 */
export default function Breadcrumbs({ origin, crumbs }: { origin: string; crumbs: Crumb[] }) {
  return (
    <>
      <JsonLd data={withContext(breadcrumbJsonLd(origin, crumbs))} />
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <Fragment key={`${index}-${crumb.name}`}>
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              {crumb.href && !last ? <Link href={crumb.href}>{crumb.name}</Link> : <span aria-current={last ? "page" : undefined}>{crumb.name}</span>}
            </Fragment>
          );
        })}
      </nav>
    </>
  );
}
