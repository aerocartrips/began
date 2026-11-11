import { pagesSitemap, productsSitemap, tenantForDomain, xmlResponse } from "@/lib/seo/sitemap";

/** The files sitemap.xml lists: pages.xml and products-N.xml. */
export async function GET(_request: Request, { params }: { params: Promise<{ domain: string; file: string }> }) {
  const { domain, file } = await params;
  const tenant = await tenantForDomain(domain);
  if (!tenant) return new Response("Not found", { status: 404 });

  if (file === "pages.xml") return xmlResponse(await pagesSitemap(tenant));
  const match = /^products-([1-9]\d{0,3})\.xml$/.exec(file);
  const body = match ? await productsSitemap(tenant, Number(match[1])) : null;
  return body ? xmlResponse(body) : new Response("Not found", { status: 404 });
}
