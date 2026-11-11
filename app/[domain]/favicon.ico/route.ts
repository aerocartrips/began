import { brandIconVersion } from "@/lib/seo/brand-icon";
import { squareIcon } from "@/lib/seo/images";
import { tenantForDomain } from "@/lib/seo/sitemap";

/**
 * /favicon.ico, which browsers and feed readers request on their own: sends
 * them to the store's 48px icon. Pages declare their icons in <head>.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ domain: string }> }) {
  const tenant = await tenantForDomain((await params).domain);
  if (!tenant) return new Response("Not found", { status: 404 });
  const favicon = tenant.branding.faviconUrl;
  // Same-site target as a relative Location, so it stays on whichever of the store's domains was asked.
  const target = favicon ? (squareIcon(favicon, 48) ?? favicon) : `/icons/icon-48.png?v=${brandIconVersion(tenant)}`;
  return new Response(null, {
    status: 302,
    headers: { Location: target, "Cache-Control": "public, max-age=3600, s-maxage=3600" },
  });
}
