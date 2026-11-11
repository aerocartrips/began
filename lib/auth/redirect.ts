/**
 * Post-sign-in destinations. Shared by proxy.ts, Server Components and the
 * browser, so it has no imports.
 */

export const LOGIN_PATH = "/account/login";
export const REGISTER_PATH = "/account/register";
export const FORGOT_PASSWORD_PATH = "/account/forgot-password";
export const RESET_PASSWORD_PATH = "/account/reset-password";

const AUTH_PATHS: ReadonlySet<string> = new Set([LOGIN_PATH, REGISTER_PATH]);
const PARSE_BASE = "http://localhost";
const MAX_LENGTH = 2048;

/** Account pages anyone may open: signing in, registering, and password reset (with its emailed link). */
const PUBLIC_ACCOUNT_PATHS: ReadonlySet<string> = new Set([...AUTH_PATHS, FORGOT_PASSWORD_PATH, RESET_PASSWORD_PATH]);

function normalizePath(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

export function isAuthPath(pathname: string) {
  return AUTH_PATHS.has(normalizePath(pathname));
}

const within = (path: string, section: string) => path === section || path.startsWith(`${section}/`);

/**
 * Pages that need a signed-in shopper: the account area, and checkout (orders
 * belong to an account, so signing in comes before the shopper fills anything in).
 */
export function isProtectedPath(pathname: string) {
  const path = normalizePath(pathname);
  if (within(path, "/checkout")) return true;
  return within(path, "/account") && !PUBLIC_ACCOUNT_PATHS.has(path);
}

/**
 * The in-store path to return to after signing in, or `fallback`.
 * Only same-origin paths are accepted, which rules out open redirects
 * (`//evil.example`, `/\evil.example`, `https://…`, `javascript:`). Auth pages
 * (they would loop) and API routes are rejected too.
 */
export function safeRedirectPath(value: string | null | undefined, fallback = "/") {
  if (typeof value !== "string" || value.length > MAX_LENGTH || !value.startsWith("/")) return fallback;
  let url: URL;
  try {
    url = new URL(value, PARSE_BASE);
  } catch {
    return fallback;
  }
  // The URL parser resolves "//host", "/\host" and stray whitespace exactly as browsers do.
  if (url.origin !== PARSE_BASE || isAuthPath(url.pathname) || url.pathname.startsWith("/api/")) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Sign-in (or register) link that brings the shopper back to `next` afterwards. */
export function authHref(next?: string | null, page: string = LOGIN_PATH) {
  const target = safeRedirectPath(next, "/");
  return target === "/" ? page : `${page}?next=${encodeURIComponent(target)}`;
}

/**
 * Where a sign-in link on the current page should return to: the page itself,
 * or, on the sign-in/register pages, the destination they already carry.
 */
export function returnPathFor(pathname: string, search: URLSearchParams | { get(name: string): string | null; toString(): string }) {
  if (isAuthPath(pathname)) return safeRedirectPath(search.get("next"), "/");
  const query = search.toString();
  return safeRedirectPath(query ? `${pathname}?${query}` : pathname, "/");
}
