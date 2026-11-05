import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/cookies";
import { authHref, isAuthPath, isProtectedPath, safeRedirectPath } from "@/lib/auth/redirect";
import { normalizeHost } from "@/lib/tenant/host";

const ACCESS_SECRET = (() => {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET?.trim() ?? "");
  return secret.length >= 32 ? secret : null;
})();

/**
 * Optimistic, cookie-only check: a signed, unexpired access token. There is no
 * database lookup here (proxy runs on every request, prefetches included);
 * pages and API routes still verify the session against the database. The
 * token's audience (store id) isn't checked either: auth cookies are host-only,
 * so a cookie on this host was issued by this store.
 */
async function hasAccessToken(request: NextRequest) {
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!token || !ACCESS_SECRET) return false;
  try {
    await jwtVerify(token, ACCESS_SECRET, { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

/**
 * Multi-tenant routing: every page request is rewritten to `/{hostname}/…`,
 * which lands in the `app/[domain]` root segment. The store itself is resolved
 * from the database (Tenant.domains) during rendering, so adding a domain needs
 * no deploy. API routes keep their paths and resolve the store from the Host header.
 *
 * Auth redirects happen here, before rendering (optimistic, cookie-only):
 * - account pages without any session cookie go to sign-in, which returns to
 *   them afterwards (pages still verify the session itself);
 * - signed-in shoppers skip the sign-in and register pages and continue to
 *   where they were headed (`?next=`), or the home page.
 */
export async function proxy(request: NextRequest) {
  const hostname = normalizeHost(request.headers.get("host"));
  if (!hostname) {
    return new NextResponse("Invalid host", { status: 400 });
  }

  const { pathname, searchParams } = request.nextUrl;
  if (isProtectedPath(pathname) && !request.cookies.has(ACCESS_COOKIE) && !request.cookies.has(REFRESH_COOKIE)) {
    const query = new URLSearchParams(searchParams);
    query.delete("_rsc"); // client-navigation cache key, not part of the page address
    const destination = query.size ? `${pathname}?${query}` : pathname;
    return NextResponse.redirect(new URL(authHref(destination), request.nextUrl));
  }
  if (isAuthPath(pathname) && (await hasAccessToken(request))) {
    return NextResponse.redirect(new URL(safeRedirectPath(searchParams.get("next"), "/"), request.nextUrl));
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${hostname}${pathname}`;
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
