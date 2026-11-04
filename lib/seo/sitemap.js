import { connectDB } from "@/lib/db/connect";
import { Product } from "@/lib/db/models/Product";
import { PRODUCT_STATUS } from "@/lib/constants/product-status";
import { getCategories, listProductSitemapEntries } from "@/lib/catalog/query";
import { STORE_PAGE_SLUGS } from "@/lib/content/store-pages";
import { getPublishedGuides } from "@/lib/content/guides";
import { runWithTenant } from "@/lib/tenant/context";
import { getTenantByDomain } from "@/lib/tenant/resolve";
import { normalizeHost } from "@/lib/tenant/host";

/** Well under the 50,000-URL limit per sitemap file. */
export const PRODUCTS_PER_SITEMAP = 10000;

const escapeXml = (value) => value.replace(/[<>&'"]/g, (character) => `&#${character.charCodeAt(0)};`);

/** Store for a metadata route under app/[domain], or null. */
export async function tenantForDomain(domain) {
  const hostname = normalizeHost(decodeURIComponent(domain));
  return hostname ? getTenantByDomain(hostname) : null;
}

export const storeOrigin = (tenant) => `https://${tenant.primaryDomain}`;

export function xmlResponse(body) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${body}`, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}

function urlSet(entries) {
  const urls = entries
    .map(({ loc, lastmod }) => `  <url><loc>${escapeXml(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`)
    .join("\n");
  return `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}

export async function sitemapIndex(tenant) {
  await connectDB();
  const count = await runWithTenant(tenant.id, () => Product.countDocuments({ status: PRODUCT_STATUS.ACTIVE }));
  const files = [
    "pages.xml",
    ...Array.from({ length: Math.ceil(count / PRODUCTS_PER_SITEMAP) }, (_, index) => `products-${index + 1}.xml`),
  ];
  const origin = storeOrigin(tenant);
  const items = files.map((file) => `  <sitemap><loc>${origin}/sitemaps/${file}</loc></sitemap>`).join("\n");
  return `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>`;
}

export async function pagesSitemap(tenant) {
  const origin = storeOrigin(tenant);
  const [allCategories, guides] = await Promise.all([getCategories(tenant.id), getPublishedGuides(tenant.id, { limit: 100 })]);
  const categories = allCategories.filter((category) => category.productCount > 0);
  return urlSet([
    { loc: `${origin}/` },
    { loc: `${origin}/products` },
    { loc: `${origin}/categories` },
    ...categories.map((category) => ({ loc: `${origin}/categories/${category.slug}` })),
    ...STORE_PAGE_SLUGS.map((slug) => ({ loc: `${origin}/${slug}` })),
    { loc: `${origin}/contact` },
    ...(guides.length ? [{ loc: `${origin}/guides` }] : []),
    ...guides.map((guide) => ({ loc: `${origin}/guides/${guide.slug}`, lastmod: guide.updatedAt.slice(0, 10) })),
  ]);
}

/** @param {number} page 1-based */
export async function productsSitemap(tenant, page) {
  const origin = storeOrigin(tenant);
  const products = await listProductSitemapEntries(tenant.id, page - 1, PRODUCTS_PER_SITEMAP);
  if (!products.length) return null;
  return urlSet(
    products.map((product) => ({
      loc: `${origin}/products/${product.slug}`,
      lastmod: product.updatedAt ? new Date(product.updatedAt).toISOString().slice(0, 10) : undefined,
    })),
  );
}
