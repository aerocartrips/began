import { cacheLife, cacheTag } from "next/cache";
import { catalogCacheTag } from "@/lib/catalog/catalog-cache";
import { subtreeTotals } from "@/lib/catalog/category-tree";
import { getCatalogueTotal } from "@/lib/catalog/home";
import { getCategories, listProductSitemapEntries } from "@/lib/catalog/query";
import { getPublishedGuides } from "@/lib/content/guides";
import { getStorePage } from "@/lib/content/pages";
import { STORE_PAGE_SLUGS } from "@/lib/content/store-pages";
import { normalizeHost } from "@/lib/tenant/host";
import { getTenantByDomain } from "@/lib/tenant/resolve";
import { storeOrigin } from "@/lib/seo/urls";

/**
 * Per-store XML sitemaps (Google's sitemap and image sitemap formats): an
 * index, one file of pages and categories, and product files with each
 * product's photos. Only indexable, canonical URLs are listed, and <lastmod>
 * is the real time of the last change (Google ignores changefreq and priority).
 *
 * @typedef {import("@/lib/tenant/types").PublicTenant} PublicTenant
 * @typedef {{ loc: string, lastmod?: string | null, images?: string[] }} SitemapEntry
 */

/**
 * Products per file. With up to 10 photos each, a file stays well under the
 * 50,000-URL and 50 MB sitemap limits and the 4.5 MB serverless response limit.
 */
export const PRODUCTS_PER_SITEMAP = 2000;
/** Photos listed per product: the main photos, then each colour's. */
const IMAGES_PER_PRODUCT = 10;

const escapeXml = (value) => value.replace(/[<>&'"]/g, (character) => `&#${character.charCodeAt(0)};`);

/** W3C datetime without milliseconds. */
const w3cDate = (value) => (value ? new Date(value).toISOString().replace(/\.\d{3}Z$/, "Z") : null);

/** Store for a route handler under app/[domain], or null. */
export async function tenantForDomain(domain) {
  const hostname = normalizeHost(decodeURIComponent(domain));
  return hostname ? getTenantByDomain(hostname) : null;
}

/** Search engines refetch sitemaps often; let the CDN answer for an hour. Never shown as search results. */
const SITEMAP_HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  "X-Robots-Tag": "noindex",
};

export function xmlResponse(body) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${body}`, { headers: SITEMAP_HEADERS });
}

/** @param {SitemapEntry[]} entries */
export function urlSet(entries) {
  const withImages = entries.some((entry) => entry.images?.length);
  const urls = entries
    .map(({ loc, lastmod, images = [] }) => {
      const parts = [`<loc>${escapeXml(loc)}</loc>`];
      if (lastmod) parts.push(`<lastmod>${lastmod}</lastmod>`);
      for (const image of images) parts.push(`<image:image><image:loc>${escapeXml(image)}</image:loc></image:image>`);
      return `  <url>${parts.join("")}</url>`;
    })
    .join("\n");
  const namespaces = `xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${withImages ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : ""}`;
  return `<urlset ${namespaces}>\n${urls}\n</urlset>`;
}

/** @param {PublicTenant} tenant */
export async function sitemapIndex(tenant) {
  const count = await getCatalogueTotal(tenant.id);
  const files = [
    "pages.xml",
    ...Array.from({ length: Math.ceil(count / PRODUCTS_PER_SITEMAP) }, (_, index) => `products-${index + 1}.xml`),
  ];
  const origin = storeOrigin(tenant);
  const items = files.map((file) => `  <sitemap><loc>${escapeXml(`${origin}/sitemaps/${file}`)}</loc></sitemap>`).join("\n");
  return `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>`;
}

/**
 * Home, listings, categories with products (their subcategories' included),
 * the store's content pages and its published guides.
 * @param {PublicTenant} tenant
 */
export async function pagesSitemap(tenant) {
  const origin = storeOrigin(tenant);
  const [categories, guides, pages] = await Promise.all([
    getCategories(tenant.id),
    getPublishedGuides(tenant.id, { limit: 100 }),
    Promise.all(STORE_PAGE_SLUGS.map((slug) => getStorePage(tenant.id, slug))),
  ]);
  const totals = subtreeTotals(categories);
  const listed = categories.filter((category) => totals.get(category.id)?.productCount > 0);
  // Any product or category change shows on the home page and the catalogue.
  const catalogueChanged = w3cDate(
    categories.reduce((latest, category) => (category.lastModified && category.lastModified > latest ? category.lastModified : latest), "") || null,
  );

  return urlSet([
    { loc: `${origin}/`, lastmod: catalogueChanged },
    { loc: `${origin}/products`, lastmod: catalogueChanged },
    ...(listed.length ? [{ loc: `${origin}/categories`, lastmod: catalogueChanged }] : []),
    ...listed.map((category) => ({
      loc: `${origin}/categories/${category.slug}`,
      lastmod: w3cDate(totals.get(category.id)?.lastModified),
    })),
    ...pages.filter(Boolean).map((page) => ({ loc: `${origin}/${page.slug}`, lastmod: w3cDate(page.updatedAt) })),
    { loc: `${origin}/contact` },
    { loc: `${origin}/track-order` },
    ...(guides.length ? [{ loc: `${origin}/guides`, lastmod: w3cDate(guides[0].updatedAt) }] : []),
    ...guides.map((guide) => ({ loc: `${origin}/guides/${guide.slug}`, lastmod: w3cDate(guide.updatedAt) })),
  ]);
}

const byPosition = (left, right) => Number(right.isPrimary) - Number(left.isPrimary) || (left.sortOrder ?? 0) - (right.sortOrder ?? 0);

/** The product's photos in gallery order, then each colour's, without repeats. */
function productPhotoUrls(product) {
  const images = [...(product.images ?? [])].sort(byPosition);
  const variants = [...(product.variants ?? [])].sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
  const urls = [...images, ...variants.flatMap((variant) => [...(variant.images ?? [])].sort(byPosition))]
    .map((image) => image.secureUrl || image.url)
    .filter((url) => typeof url === "string" && /^https?:\/\//.test(url));
  return [...new Set(urls)].slice(0, IMAGES_PER_PRODUCT);
}

/**
 * One product file, or null past the last one.
 * @param {PublicTenant} tenant
 * @param {number} page 1-based
 */
export async function productsSitemap(tenant, page) {
  "use cache";
  cacheLife("hours");
  cacheTag(catalogCacheTag(tenant.id));

  const origin = storeOrigin(tenant);
  const products = await listProductSitemapEntries(tenant.id, page - 1, PRODUCTS_PER_SITEMAP);
  if (!products.length) return null;
  return urlSet(
    products.map((product) => ({
      loc: `${origin}/products/${product.slug}`,
      lastmod: w3cDate(product.updatedAt),
      images: productPhotoUrls(product),
    })),
  );
}
