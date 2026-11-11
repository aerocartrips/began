import { calculateShipping } from "@/lib/services/order-pricing";
import { ANONYMOUS_REVIEWER } from "@/lib/services/review-dto";
import { VARIANT_PARAM, variantParamValues } from "@/lib/catalog/variant-url";
import { cloudinaryTransform, structuredDataImages } from "@/lib/seo/images";
import { storeOrigin } from "@/lib/seo/urls";

/**
 * schema.org structured data (JSON-LD), built to Google Search Central's
 * documentation for merchant listings, product variants, Organization
 * (OnlineStore) with return and shipping policies, breadcrumbs, articles and
 * site names. Only facts the store has configured or shows on the page are
 * marked up. Render the result with components/seo/json-ld.tsx.
 *
 * @typedef {import("@/lib/tenant/types").PublicTenant} PublicTenant
 * @typedef {import("@/lib/content/types").StorePolicies} StorePolicies
 * @typedef {import("@/features/catalog/types").ProductDetailData} ProductDetailData
 * @typedef {import("@/features/reviews/types").PublicReview} PublicReview
 * @typedef {import("@/features/guides/types").GuideArticle} GuideArticle
 * @typedef {{ name: string, href?: string }} Crumb
 */

const SCHEMA = "https://schema.org";
/** Every store sells in India, in rupees. */
const COUNTRY = "IN";
const CURRENCY = "INR";

export const organizationId = (origin) => `${origin}/#organization`;
export const websiteId = (origin) => `${origin}/#website`;

/** @param {Record<string, unknown>} node */
export const withContext = (node) => ({ "@context": SCHEMA, ...node });

/** Linked entities in one script (they reference each other by @id). */
export const graph = (nodes) => ({ "@context": SCHEMA, "@graph": nodes });

const siteNameOf = (tenant) => tenant.branding.siteTitle || tenant.name;

/**
 * Phone number with its country code, as Google asks for: 10-digit Indian
 * numbers get +91; numbers already in international form keep it.
 * @param {string | undefined} phone
 */
export function internationalPhone(phone) {
  const value = (phone ?? "").trim();
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (value.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return value;
}

/** A logo Google accepts (at least 112px square, legible on white): padded to 512px when it is on Cloudinary. */
const logoUrl = (url) => cloudinaryTransform(url, "c_pad,w_512,h_512,b_white,f_png") ?? url;

const days = (value) => Math.max(0, Math.trunc(Number(value) || 0));

/** @param {number} min @param {number} max */
const dayRange = (min, max) => ({ "@type": "QuantitativeValue", minValue: Math.min(min, max), maxValue: max, unitCode: "DAY" });

/**
 * Dispatch (handling) and delivery (transit) times from the store's settings;
 * each is left out until its maximum is set.
 * @param {StorePolicies} policies
 */
function deliveryTimes(policies) {
  const dispatchMax = days(policies.dispatchMaxDays);
  const transitMax = days(policies.transitMaxDays);
  return {
    handling: dispatchMax > 0 ? dayRange(days(policies.dispatchMinDays), dispatchMax) : null,
    transit: transitMax > 0 ? dayRange(days(policies.transitMinDays), transitMax) : null,
  };
}

/**
 * The store's return policy (Organization-level `hasMerchantReturnPolicy`),
 * from the return window in its settings; returns go back by courier.
 * @param {string} origin
 * @param {StorePolicies} policies
 */
export function returnPolicyJsonLd(origin, policies) {
  const windowDays = days(policies.returnWindowDays);
  const base = { "@type": "MerchantReturnPolicy", applicableCountry: COUNTRY, merchantReturnLink: `${origin}/returns` };
  if (!windowDays) return { ...base, returnPolicyCategory: `${SCHEMA}/MerchantReturnNotPermitted` };
  return {
    ...base,
    returnPolicyCountry: COUNTRY,
    returnPolicyCategory: `${SCHEMA}/MerchantReturnFiniteReturnWindow`,
    merchantReturnDays: windowDays,
    returnMethod: `${SCHEMA}/ReturnByMail`,
    refundType: `${SCHEMA}/FullRefund`,
  };
}

/**
 * The same policy on a product offer, with the properties Google reads at that level.
 * @param {StorePolicies} policies
 */
function offerReturnPolicy(policies) {
  const windowDays = days(policies.returnWindowDays);
  return windowDays
    ? {
        "@type": "MerchantReturnPolicy",
        applicableCountry: COUNTRY,
        returnPolicyCategory: `${SCHEMA}/MerchantReturnFiniteReturnWindow`,
        merchantReturnDays: windowDays,
        returnMethod: `${SCHEMA}/ReturnByMail`,
      }
    : { "@type": "MerchantReturnPolicy", applicableCountry: COUNTRY, returnPolicyCategory: `${SCHEMA}/MerchantReturnNotPermitted` };
}

/**
 * Organization-level shipping (`hasShippingService`): the checkout's own rule,
 * a flat charge per order that becomes free from the free-shipping threshold.
 * @param {StorePolicies} policies
 */
export function shippingServiceJsonLd(policies) {
  const flat = Math.max(0, Number(policies.shippingFlatAmount) || 0);
  const freeFrom = Math.max(0, Number(policies.shippingFreeThreshold) || 0);
  const { handling, transit } = deliveryTimes(policies);
  const condition = (rate, orderValue) => ({
    "@type": "ShippingConditions",
    shippingDestination: { "@type": "DefinedRegion", addressCountry: COUNTRY },
    ...(orderValue ? { orderValue: { "@type": "MonetaryAmount", currency: CURRENCY, ...orderValue } } : {}),
    shippingRate: { "@type": "MonetaryAmount", value: rate, currency: CURRENCY },
    ...(transit ? { transitTime: { "@type": "ServicePeriod", duration: transit } } : {}),
  });
  const conditions =
    flat > 0 && freeFrom > 0
      ? [condition(flat, { minValue: 0, maxValue: Math.round((freeFrom - 0.01) * 100) / 100 }), condition(0, { minValue: freeFrom })]
      : [condition(flat)];
  return {
    "@type": "ShippingService",
    name: "Delivery across India",
    fulfillmentType: `${SCHEMA}/FulfillmentTypeDelivery`,
    ...(handling ? { handlingTime: { "@type": "ServicePeriod", duration: handling } } : {}),
    shippingConditions: conditions.length === 1 ? conditions[0] : conditions,
  };
}

/**
 * Shipping for one product offer (`shippingDetails`), priced for its smallest
 * order (minimum quantity × price) with the checkout's own rule. Google
 * requires a delivery time here, so it is left out until the store sets one.
 * @param {StorePolicies} policies
 * @param {number} orderValue
 */
export function offerShippingDetails(policies, orderValue) {
  const { handling, transit } = deliveryTimes(policies);
  if (!handling && !transit) return null;
  return {
    "@type": "OfferShippingDetails",
    shippingRate: { "@type": "MonetaryAmount", value: calculateShipping(orderValue, policies), currency: CURRENCY },
    shippingDestination: { "@type": "DefinedRegion", addressCountry: COUNTRY },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      ...(handling ? { handlingTime: handling } : {}),
      ...(transit ? { transitTime: transit } : {}),
    },
  };
}

/**
 * The store as an OnlineStore (the Organization subtype Google asks
 * ecommerce sites to use), with its contact details, profiles, GSTIN and its
 * store-wide return and shipping policies. Home page only.
 * @param {PublicTenant} tenant
 * @param {StorePolicies} policies
 */
export function organizationJsonLd(tenant, policies) {
  const origin = storeOrigin(tenant);
  const { branding, contact, business } = tenant;
  const name = siteNameOf(tenant);
  const telephone = internationalPhone(contact.phone);
  const address = (contact.address || business.registeredAddress).replace(/\s*\n\s*/g, ", ").trim();
  const sameAs = Object.values(contact.social ?? {}).filter((url) => typeof url === "string" && url.startsWith("https://"));
  const contactPoint = contact.email || telephone
    ? {
        "@type": "ContactPoint",
        contactType: "customer service",
        ...(contact.email ? { email: contact.email } : {}),
        ...(telephone ? { telephone } : {}),
        areaServed: COUNTRY,
        availableLanguage: "en",
      }
    : null;

  return {
    "@type": "OnlineStore",
    "@id": organizationId(origin),
    name,
    ...(tenant.name !== name ? { alternateName: tenant.name } : {}),
    url: `${origin}/`,
    ...(business.legalName && business.legalName !== name ? { legalName: business.legalName } : {}),
    ...(branding.description ? { description: branding.description } : {}),
    ...(branding.logoUrl ? { logo: { "@type": "ImageObject", url: logoUrl(branding.logoUrl) } } : {}),
    ...(contact.email ? { email: contact.email } : {}),
    ...(telephone ? { telephone } : {}),
    ...(contactPoint ? { contactPoint } : {}),
    ...(address ? { address: { "@type": "PostalAddress", streetAddress: address, addressCountry: COUNTRY } } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(business.gstin ? { vatID: business.gstin } : {}),
    hasMerchantReturnPolicy: returnPolicyJsonLd(origin, policies),
    hasShippingService: shippingServiceJsonLd(policies),
  };
}

/**
 * The site itself, for the site name Google shows (home page only).
 * @param {PublicTenant} tenant
 */
export function websiteJsonLd(tenant) {
  const origin = storeOrigin(tenant);
  const name = siteNameOf(tenant);
  return {
    "@type": "WebSite",
    "@id": websiteId(origin),
    name,
    ...(tenant.name !== name ? { alternateName: tenant.name } : {}),
    url: `${origin}/`,
    inLanguage: "en-IN",
    publisher: { "@id": organizationId(origin) },
  };
}

/**
 * The trail shown in a page's breadcrumb navigation; the last crumb is the page itself.
 * @param {string} origin
 * @param {Crumb[]} crumbs
 */
export function breadcrumbJsonLd(origin, crumbs) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      ...(crumb.href && index < crumbs.length - 1 ? { item: `${origin}${crumb.href}` } : {}),
    })),
  };
}

/** @param {ProductDetailData["rating"]} rating */
const aggregateRating = (rating) =>
  rating.count > 0
    ? {
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: Math.round(rating.average * 10) / 10,
          reviewCount: rating.count,
          bestRating: 5,
          worstRating: 1,
        },
      }
    : {};

/**
 * The reviews the page shows. Google needs a person's name as the author, so
 * reviews bylined with the anonymous fallback are left out.
 * @param {PublicReview[]} reviews
 */
function reviewNodes(reviews) {
  return reviews
    .filter((review) => review.authorName && review.authorName !== ANONYMOUS_REVIEWER && review.comment)
    .map((review) => ({
      "@type": "Review",
      author: { "@type": "Person", name: review.authorName },
      ...(review.createdAt ? { datePublished: review.createdAt.slice(0, 10) } : {}),
      reviewRating: { "@type": "Rating", ratingValue: review.rating, bestRating: 5, worstRating: 1 },
      ...(review.title ? { name: review.title } : {}),
      reviewBody: review.comment,
    }));
}

const MAX_IMAGES = 10;

/** Product photos: the cover in the 1:1, 4:3 and 16:9 shapes Google recommends, then the other photos. */
function productImages(images) {
  if (!images.length) return [];
  const [cover, ...rest] = images;
  return [...new Set([...structuredDataImages(cover.url), cover.url, ...rest.map((image) => image.url)])].slice(0, MAX_IMAGES + 3);
}

const collapse = (text) => text.replace(/\s+/g, " ").trim();

/**
 * Product markup for a product page (merchant listings and product snippets).
 * A product with colours becomes a ProductGroup whose variants each have
 * their own SKU, photos, stock and `?color=` URL; one without is a Product.
 * @param {{ tenant: PublicTenant, product: ProductDetailData, reviews: PublicReview[], policies: StorePolicies }} input
 */
export function productJsonLd({ tenant, product, reviews, policies }) {
  const origin = storeOrigin(tenant);
  const url = `${origin}/products/${product.slug}`;
  const spec = (label) => product.specs.find((entry) => entry.label === label)?.value;
  const material = spec("Fabric");
  const pattern = spec("Pattern");
  const minimum = Math.max(1, product.minimumQuantity);
  const returnPolicy = offerReturnPolicy(policies);
  const shippingDetails = offerShippingDetails(policies, product.price * minimum);
  const description = collapse(product.description || product.shortDescription || product.seoDescription).slice(0, 5000);
  const reviewList = reviewNodes(reviews);

  /** @param {boolean} purchasable @param {string} offerUrl */
  const offer = (purchasable, offerUrl) => ({
    "@type": "Offer",
    url: offerUrl,
    priceCurrency: CURRENCY,
    price: product.price,
    availability: `${SCHEMA}/${purchasable ? "InStock" : "OutOfStock"}`,
    itemCondition: `${SCHEMA}/NewCondition`,
    ...(minimum > 1 ? { eligibleQuantity: { "@type": "QuantitativeValue", minValue: minimum, unitCode: "C62" } } : {}),
    ...(product.compareAtPrice
      ? {
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            priceType: `${SCHEMA}/StrikethroughPrice`,
            price: product.compareAtPrice,
            priceCurrency: CURRENCY,
          },
        }
      : {}),
    ...(shippingDetails ? { shippingDetails } : {}),
    hasMerchantReturnPolicy: returnPolicy,
  });
  // Merchant listings need a price above zero; without one the page is still a product snippet.
  const offers = (purchasable, offerUrl) => (product.price > 0 ? { offers: offer(purchasable, offerUrl) } : {});

  const shared = {
    name: product.name,
    ...(description ? { description } : {}),
    url,
    image: productImages(product.images),
    brand: { "@type": "Brand", name: tenant.name },
    ...(product.category ? { category: product.category.name } : {}),
    ...(material ? { material } : {}),
    ...(pattern ? { pattern } : {}),
    ...aggregateRating(product.rating),
    ...(reviewList.length ? { review: reviewList } : {}),
  };

  // The page lets shoppers buy only at or above the minimum quantity.
  if (!product.variants.length) {
    return withContext({ "@type": "Product", "@id": `${url}#product`, ...shared, sku: product.sku, ...offers(product.stock >= minimum, url) });
  }
  // One colour is not a choice: a single Product, sold as that colour's SKU.
  if (product.variants.length === 1) {
    const [only] = product.variants;
    return withContext({
      "@type": "Product",
      "@id": `${url}#product`,
      ...shared,
      sku: only.sku,
      color: only.colorName,
      ...offers(only.stock >= minimum, url),
    });
  }

  const params = variantParamValues(product.variants);
  return withContext({
    "@type": "ProductGroup",
    "@id": `${url}#product`,
    ...shared,
    productGroupID: product.sku,
    variesBy: [`${SCHEMA}/color`],
    hasVariant: product.variants.map((variant) => ({
      "@type": "Product",
      name: `${product.name} – ${variant.colorName}`,
      sku: variant.sku,
      color: variant.colorName,
      image: (variant.images.length ? variant.images : product.images).slice(0, MAX_IMAGES).map((image) => image.url),
      ...(material ? { material } : {}),
      ...(pattern ? { pattern } : {}),
      ...offers(variant.stock >= minimum, `${url}?${VARIANT_PARAM}=${params.get(variant.id)}`),
    })),
  });
}

/**
 * A buying guide as an Article, published by the store.
 * @param {PublicTenant} tenant
 * @param {GuideArticle} guide
 */
export function articleJsonLd(tenant, guide) {
  const origin = storeOrigin(tenant);
  const url = `${origin}/guides/${guide.slug}`;
  const name = siteNameOf(tenant);
  return {
    "@type": "Article",
    "@id": `${url}#article`,
    headline: guide.title,
    ...(guide.excerpt ? { description: guide.excerpt } : {}),
    ...(guide.coverImage ? { image: structuredDataImages(guide.coverImage.url) } : {}),
    datePublished: guide.publishedAt,
    dateModified: guide.updatedAt,
    author: { "@type": "Organization", name, url: `${origin}/about` },
    publisher: {
      "@type": "Organization",
      "@id": organizationId(origin),
      name,
      ...(tenant.branding.logoUrl ? { logo: { "@type": "ImageObject", url: logoUrl(tenant.branding.logoUrl) } } : {}),
    },
    mainEntityOfPage: url,
    inLanguage: "en-IN",
  };
}

/**
 * @param {{ question: string, answer: string }[]} faqs
 */
export function faqJsonLd(faqs) {
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}
