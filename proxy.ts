import { NextResponse, type NextRequest } from "next/server";
import { normalizeHost } from "@/lib/tenant/host";

/**
 * Multi-tenant routing: every page request is rewritten to `/{hostname}/…`,
 * which lands in the `app/[domain]` root segment. The store itself is resolved
 * from the database (Tenant.domains) during rendering, so adding a domain needs
 * no deploy. API routes keep their paths and resolve the store from the Host header.
 */
export function proxy(request: NextRequest) {
  const hostname = normalizeHost(request.headers.get("host"));
  if (!hostname) {
    return new NextResponse("Invalid host", { status: 400 });
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${hostname}${url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    // Everything except API routes, Next.js internals and files with an extension (public/ assets).
    "/((?!api/|_next/|_vercel|.*\\.[\\w]+$).*)",
    // Per-store metadata routes served from app/[domain].
    "/sitemap.xml",
    "/sitemaps/:path*",
    "/robots.txt",
  ],
};
