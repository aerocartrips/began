import JsonLd from "@/components/seo/json-ld";
import { getStorePolicies } from "@/lib/content/pages";
import { graph, organizationJsonLd, websiteJsonLd } from "@/lib/seo/structured-data";
import type { PublicTenant } from "@/lib/tenant/types";

/**
 * The store (OnlineStore, with its return and shipping policies) and the site
 * (WebSite, for the site name in results), linked by @id. Home page only, as
 * Google asks. No SearchAction: Google retired the sitelinks search box in
 * November 2024. Product and rating markup belongs on product pages.
 */
export default async function HomeStructuredData({ tenant }: { tenant: PublicTenant }) {
  const policies = await getStorePolicies(tenant.id);
  return <JsonLd data={graph([organizationJsonLd(tenant, policies), websiteJsonLd(tenant)])} />;
}
