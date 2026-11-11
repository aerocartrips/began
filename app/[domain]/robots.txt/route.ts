import { robotsTxt } from "@/lib/seo/robots";
import { tenantForDomain } from "@/lib/seo/sitemap";

/** robots.txt for the store on this domain (lib/seo/robots.js); hosts without a store are not crawled. */
export async function GET(_request: Request, { params }: { params: Promise<{ domain: string }> }) {
  const tenant = await tenantForDomain((await params).domain);
  return new Response(robotsTxt(tenant), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
