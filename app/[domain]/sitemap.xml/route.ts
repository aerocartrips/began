import { sitemapIndex, tenantForDomain, xmlResponse } from "@/lib/seo/sitemap";

/** Sitemap index for the store on this domain. */
export async function GET(_request: Request, { params }: { params: Promise<{ domain: string }> }) {
  const tenant = await tenantForDomain((await params).domain);
  if (!tenant) return new Response("Not found", { status: 404 });
  return xmlResponse(await sitemapIndex(tenant));
}
