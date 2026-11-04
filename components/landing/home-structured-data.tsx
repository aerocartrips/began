import JsonLd from "@/components/seo/json-ld";
import type { PublicTenant } from "@/lib/tenant/types";

/**
 * Organization and WebSite (with site search) structured data, from the
 * store's own settings only. No product or rating markup here: those belong
 * on product pages, where the data is shown in full.
 */
export default function HomeStructuredData({ tenant }: { tenant: PublicTenant }) {
  const origin = `https://${tenant.primaryDomain}`;
  const name = tenant.branding.siteTitle || tenant.name;
  const sameAs = Object.values(tenant.contact.social ?? {}).filter((url): url is string => Boolean(url?.startsWith("https://")));
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name,
      url: origin,
      ...(tenant.business.legalName ? { legalName: tenant.business.legalName } : {}),
      ...(tenant.branding.logoUrl ? { logo: tenant.branding.logoUrl } : {}),
      ...(tenant.contact.email ? { email: tenant.contact.email } : {}),
      ...(tenant.contact.phone ? { telephone: tenant.contact.phone } : {}),
      ...(sameAs.length ? { sameAs } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name,
      url: origin,
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${origin}/search?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
  ];
  return <JsonLd data={data} />;
}
