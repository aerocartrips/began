import type { Metadata } from "next";
import type { CatalogQuery, CatalogResult } from "@/features/catalog/types";
import type { PublicTenant } from "@/lib/tenant/types";
import { brandIconVersion } from "@/lib/seo/brand-icon";
import { shareImage, squareIcon } from "@/lib/seo/images";
import { ROBOTS_INDEX, ROBOTS_NOINDEX, ROBOTS_PRIVATE } from "@/lib/seo/robots";
import { absoluteUrl, storeOrigin } from "@/lib/seo/urls";

/**
 * One place that turns a page's facts into its <head>: title, description,
 * canonical URL, robots rules, Open Graph and X cards. Every storefront page
 * goes through pageMetadata, so each one carries the complete set (Next merges
 * metadata shallowly, so a page that set only part of `openGraph` used to lose
 * the store-wide og:site_name and og:locale).
 */

export type SeoImage = { url: string; alt?: string; width?: number; height?: number };

export type PageSeo = {
  title: string;
  /** Use the title as it is, without the " | Store" suffix (home page). */
  absoluteTitle?: boolean;
  description?: string;
  /** Canonical path, e.g. "/products?page=2". Left out for pages that aren't indexed. */
  path?: string;
  /** Share images, best first; the store's default image when empty. */
  images?: SeoImage[];
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  robots?: "index" | "noindex" | "private";
  /** Neighbouring pages of a paginated listing (rel="prev"/"next", read by Bing). */
  pagination?: { previous?: string | null; next?: string | null };
};

const ROBOTS = { index: ROBOTS_INDEX, noindex: ROBOTS_NOINDEX, private: ROBOTS_PRIVATE } as const;

export const siteNameOf = (tenant: PublicTenant) => tenant.branding.siteTitle || tenant.name;

/** "@handle" from the store's X profile URL (x.com or twitter.com), for twitter:site. */
export function xHandle(profileUrl: string | undefined) {
  const match = /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/@?([A-Za-z0-9_]{1,15})\/?(?:[?#].*)?$/i.exec(profileUrl ?? "");
  return match ? `@${match[1]}` : undefined;
}

/** The store's own share image: its home page photo, else its logo. */
function defaultImages(tenant: PublicTenant): SeoImage[] {
  const { heroImageUrl, logoUrl } = tenant.branding;
  const source = heroImageUrl || logoUrl;
  return source ? [shareImage(source, siteNameOf(tenant))] : [];
}

/**
 * Favicons: the store's own icon as square PNGs (Google shows square icons only;
 * 48px multiples, plus Apple's 180px), or a generated monogram in the store's
 * brand colour when it has none (app/[domain]/icons).
 */
function storeIcons(tenant: PublicTenant): Metadata["icons"] {
  const favicon = tenant.branding.faviconUrl;
  if (favicon) {
    const sized = (size: number) => squareIcon(favicon, size);
    if (!sized(48)) return { icon: [{ url: favicon }], apple: [{ url: favicon }] };
    return {
      icon: [48, 96, 192].map((size) => ({ url: sized(size)!, sizes: `${size}x${size}`, type: "image/png" })),
      apple: [{ url: sized(180)!, sizes: "180x180", type: "image/png" }],
    };
  }
  const version = brandIconVersion(tenant);
  return {
    icon: [48, 96, 192].map((size) => ({ url: `/icons/icon-${size}.png?v=${version}`, sizes: `${size}x${size}`, type: "image/png" })),
    apple: [{ url: `/icons/apple-touch-icon.png?v=${version}`, sizes: "180x180", type: "image/png" }],
  };
}

/** Search Console and Bing Webmaster Tools ownership tags (Admin → Store settings → SEO). */
function verification(tenant: PublicTenant): Metadata["verification"] {
  const { googleSiteVerification, bingSiteVerification } = tenant.seo;
  if (!googleSiteVerification && !bingSiteVerification) return undefined;
  return {
    ...(googleSiteVerification ? { google: googleSiteVerification } : {}),
    ...(bingSiteVerification ? { other: { "msvalidate.01": bingSiteVerification } } : {}),
  };
}

/** Store-wide defaults, set once in the root layout; pages override what they know. */
export function rootMetadata(tenant: PublicTenant): Metadata {
  const siteName = siteNameOf(tenant);
  const images = defaultImages(tenant);
  return {
    metadataBase: new URL(storeOrigin(tenant)),
    title: { default: siteName, template: `%s | ${siteName}` },
    description: tenant.branding.description || undefined,
    applicationName: siteName,
    robots: ROBOTS_INDEX,
    icons: storeIcons(tenant),
    openGraph: { type: "website", siteName, locale: "en_IN", images },
    twitter: { card: images.length ? "summary_large_image" : "summary", site: xHandle(tenant.contact.social.x) },
    verification: verification(tenant),
  };
}

/** Complete metadata for one page. */
export function pageMetadata(tenant: PublicTenant, page: PageSeo): Metadata {
  const siteName = siteNameOf(tenant);
  const description = page.description || tenant.branding.description || undefined;
  const url = page.path ? absoluteUrl(tenant, page.path) : undefined;
  const images = page.images?.length ? page.images : defaultImages(tenant);
  const socialTitle = page.title;
  const article = page.type === "article" ? { publishedTime: page.publishedTime, modifiedTime: page.modifiedTime } : {};

  return {
    title: page.absoluteTitle ? { absolute: page.title } : page.title,
    description,
    ...(url ? { alternates: { canonical: url } } : {}),
    robots: ROBOTS[page.robots ?? "index"],
    openGraph: {
      type: page.type ?? "website",
      siteName,
      locale: "en_IN",
      title: socialTitle,
      description,
      ...(url ? { url } : {}),
      images,
      ...article,
    },
    twitter: {
      card: images.length ? "summary_large_image" : "summary",
      site: xHandle(tenant.contact.social.x),
      title: socialTitle,
      description,
      images: images.map((image) => ({ url: image.url, ...(image.alt ? { alt: image.alt } : {}) })),
    },
    ...(page.pagination
      ? {
          pagination: {
            previous: page.pagination.previous ? absoluteUrl(tenant, page.pagination.previous) : undefined,
            next: page.pagination.next ? absoluteUrl(tenant, page.pagination.next) : undefined,
          },
        }
      : {}),
  };
}

/** Pages behind a sign-in or reached from a one-time link: titled, never indexed. */
export function privatePageMetadata(title: string): Metadata {
  return { title, robots: ROBOTS_PRIVATE };
}

/**
 * A listing (/products, /categories/[slug]) with no search, filter or sort:
 * the version search engines should index. Filters and sorts are variations
 * of it (blocked in robots.txt, and noindex if reached anyway).
 */
export function isPlainListing(query: CatalogQuery, basePath: string) {
  const filtered =
    Boolean(query.q) ||
    (Boolean(query.category) && !basePath.startsWith("/categories/")) ||
    query.fabric.length > 0 ||
    query.weave.length > 0 ||
    query.occasion.length > 0 ||
    query.color.length > 0 ||
    query.minPrice !== null ||
    query.maxPrice !== null ||
    query.inStock;
  return !filtered && query.sort === "newest";
}

/** Canonical path of one page of a plain listing: each page is its own canonical (not page 1). */
export function listingPath(basePath: string, page: number) {
  return page > 1 ? `${basePath}?page=${page}` : basePath;
}

/**
 * Metadata for a listing page. Only plain listings with products are indexed;
 * every page of them gets its own canonical URL and prev/next links. Callers
 * respond 404 to pages past the last one before calling this.
 */
export function listingMetadata(
  tenant: PublicTenant,
  listing: { basePath: string; title: string; description: string; query: CatalogQuery; result: CatalogResult; image?: SeoImage | null },
): Metadata {
  const { basePath, query, result } = listing;
  const indexable = isPlainListing(query, basePath) && result.total > 0;
  const page = query.page;
  return pageMetadata(tenant, {
    title: page > 1 ? `${listing.title} – Page ${page}` : listing.title,
    description: listing.description,
    path: indexable ? listingPath(basePath, page) : undefined,
    robots: indexable ? "index" : "noindex",
    images: listing.image ? [listing.image] : undefined,
    pagination: indexable
      ? {
          previous: page > 1 ? listingPath(basePath, page - 1) : null,
          next: page < result.pageCount ? listingPath(basePath, page + 1) : null,
        }
      : undefined,
  });
}

/** A listing's share image: the first product's photo. */
export function listingImage(result: CatalogResult): SeoImage | null {
  const image = result.items.find((item) => item.image)?.image;
  return image ? shareImage(image.url, image.alt) : null;
}
