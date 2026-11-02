import { storeOrigin, tenantForDomain } from "@/lib/seo/sitemap";

const PRIVATE_PATHS = ["/admin", "/account", "/cart", "/checkout", "/wishlist", "/api/"];

/** robots.txt for the store on this domain; unknown hosts are not indexed. */
export async function GET(_request: Request, { params }: { params: Promise<{ domain: string }> }) {
  const tenant = await tenantForDomain((await params).domain);
  const body = tenant
    ? ["User-agent: *", "Allow: /", ...PRIVATE_PATHS.map((path) => `Disallow: ${path}`), "", `Sitemap: ${storeOrigin(tenant)}/sitemap.xml`].join("\n")
    : "User-agent: *\nDisallow: /";
  return new Response(`${body}\n`, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
