/**
 * Fallback favicon for stores without their own icon: the store's initial on
 * its brand colour, drawn by app/[domain]/icons/[file]/route.tsx. Without it
 * every such store would show the framework's default icon in search results.
 */

/** Icon files the route serves, by name, with their pixel size. */
export const BRAND_ICON_FILES = {
  "icon-48.png": 48,
  "icon-96.png": 96,
  "icon-192.png": 192,
  "icon-512.png": 512,
  "apple-touch-icon.png": 180,
};

/**
 * Changes whenever the icon would look different, so icon URLs carry it as
 * `?v=` and can be cached for good (FNV-1a over name and colours).
 * @param {{ name: string, slug: string, branding: { siteTitle: string, theme: { brand?: string } } }} tenant
 */
export function brandIconVersion(tenant) {
  const input = `${monogramOf(tenant)}|${tenant.branding.theme.brand ?? ""}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * The store's initial. Store names can be in any script; the bundled icon font
 * covers Latin only, so other names fall back to the store's ASCII slug.
 * @param {{ name: string, slug: string, branding: { siteTitle: string } }} tenant
 */
export function monogramOf(tenant) {
  const fromName = /[A-Za-z0-9]/.exec(tenant.branding.siteTitle || tenant.name)?.[0];
  return (fromName ?? /[a-z0-9]/.exec(tenant.slug)?.[0] ?? "S").toUpperCase();
}
