import { describe, expect, it } from "vitest";
import { categoryTrail, subtreeTotals } from "@/lib/catalog/category-tree";
import { variantFromParam, variantParamValues } from "@/lib/catalog/variant-url";
import { defaultStorePage, dispatchWindow } from "@/lib/content/store-pages";
import { brandIconVersion, monogramOf } from "@/lib/seo/brand-icon";
import { categoryDescription, productDescription } from "@/lib/seo/descriptions";
import { cloudinaryTransform, shareImage, squareIcon, structuredDataImages } from "@/lib/seo/images";
import { isPlainListing, listingMetadata, pageMetadata, rootMetadata, xHandle } from "@/lib/seo/metadata";
import { robotsTxt } from "@/lib/seo/robots";
import { urlSet } from "@/lib/seo/sitemap";
import {
  breadcrumbJsonLd,
  internationalPhone,
  organizationJsonLd,
  productJsonLd,
  returnPolicyJsonLd,
  shippingServiceJsonLd,
  websiteJsonLd,
} from "@/lib/seo/structured-data";
import { rememberSlug } from "@/lib/utils/slugify";

const CLOUD = "https://res.cloudinary.com/demo/image/upload";

const tenant = {
  id: "64b7f0c2a1b2c3d4e5f60718",
  slug: "silk-house",
  name: "Silk House",
  primaryDomain: "silks.example",
  salesMode: "wholesale",
  branding: {
    siteTitle: "Silk House",
    tagline: "Handwoven sarees",
    description: "Handwoven sarees from Varanasi.",
    logoUrl: `${CLOUD}/v1/brand/logo.png`,
    heroImageUrl: "",
    faviconUrl: "",
    theme: { brand: "#6863ed" },
  },
  contact: {
    email: "hello@silks.example",
    phone: "98765 43210",
    address: "12 Weavers Lane\nVaranasi",
    hours: "",
    social: { instagram: "https://instagram.com/silkhouse", x: "https://x.com/silkhouse", linkedin: "http://insecure.example" },
  },
  business: { legalName: "Silk House Pvt Ltd", gstin: "09ABCDE1234F1Z5", registeredAddress: "", invoicePrefix: "INV" },
  notificationEmail: "",
  razorpayKeyId: "",
  seo: { googleSiteVerification: "", bingSiteVerification: "" },
};

const policies = {
  returnWindowDays: 7,
  shippingFlatAmount: 150,
  shippingFreeThreshold: 5000,
  lowStockThreshold: 5,
  paymentReservationMinutes: 30,
  dispatchMinDays: 2,
  dispatchMaxDays: 4,
  transitMinDays: 0,
  transitMaxDays: 0,
};

const product = {
  id: "p1",
  slug: "banarasi-red",
  name: "Banarasi Red",
  sku: "BAN-1",
  image: null,
  price: 400,
  compareAtPrice: null,
  discountPercent: null,
  bestTier: null,
  minimumQuantity: 10,
  inStock: true,
  isNew: false,
  rating: { average: 4.25, count: 2 },
  swatches: [],
  shortDescription: "",
  description: "Pure silk  saree.\nZari border.",
  category: { name: "Banarasi", slug: "banarasi" },
  images: [
    { url: `${CLOUD}/v1/p/front.jpg`, alt: "Front" },
    { url: `${CLOUD}/v1/p/back.jpg`, alt: "Back" },
  ],
  variants: [],
  tiers: [],
  pricing: { price: 400, compareAtPrice: 0, wholesalePrice: 400, minimumOrderQuantity: 10 },
  stock: 25,
  specs: [
    { label: "Fabric", value: "Silk" },
    { label: "Weave", value: "Kadhwa" },
    { label: "Pattern", value: "Zari buta" },
  ],
  careInstructions: "",
  seoTitle: "Banarasi Red",
  seoDescription: "",
  ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 },
};

const reviews = [
  { _id: "r1", productId: "p1", rating: 5, title: "Lovely", comment: "Beautiful zari.", images: [], verificationStatus: "verified", helpfulCount: 0, createdAt: "2026-10-01T10:00:00.000Z", authorName: "Priya", verifiedPurchase: true },
  { _id: "r2", productId: "p1", rating: 4, title: "", comment: "Nice drape.", images: [], verificationStatus: "verified", helpfulCount: 0, createdAt: "2026-10-02T10:00:00.000Z", authorName: "Verified buyer", verifiedPurchase: true },
];

describe("Cloudinary-derived search images", () => {
  it("appends to the end of the transformation chain, before the version and public id", () => {
    expect(cloudinaryTransform(`${CLOUD}/v123/folder/photo.jpg`, "c_pad,w_10")).toBe(`${CLOUD}/c_pad,w_10/v123/folder/photo.jpg`);
    expect(cloudinaryTransform(`${CLOUD}/c_lfill,ar_3:4,w_640,f_auto,q_auto/folder/photo`, "w_48")).toBe(
      `${CLOUD}/c_lfill,ar_3:4,w_640,f_auto,q_auto/w_48/folder/photo`,
    );
    // Folder names are not mistaken for transformations.
    expect(cloudinaryTransform(`${CLOUD}/my_photos/saree.jpg`, "w_48")).toBe(`${CLOUD}/w_48/my_photos/saree.jpg`);
    expect(cloudinaryTransform("https://images.example/saree.jpg", "w_48")).toBeNull();
  });

  it("pads share cards to 1200×630 and favicons to squares, and leaves other hosts alone", () => {
    expect(shareImage(`${CLOUD}/v1/p.jpg`, "Saree")).toEqual({
      url: `${CLOUD}/c_pad,w_1200,h_630,b_auto,f_jpg,q_auto/v1/p.jpg`,
      width: 1200,
      height: 630,
      alt: "Saree",
    });
    expect(shareImage("https://images.example/p.jpg")).toEqual({ url: "https://images.example/p.jpg" });
    expect(squareIcon(`${CLOUD}/v1/icon.png`, 192)).toBe(`${CLOUD}/c_pad,w_192,h_192,b_white,f_png/v1/icon.png`);
    expect(structuredDataImages(`${CLOUD}/v1/p.jpg`).map((url) => /c_pad,w_(\d+),h_(\d+)/.exec(url).slice(1).join("x"))).toEqual([
      "1200x1200",
      "1200x900",
      "1200x675",
    ]);
    expect(structuredDataImages("https://images.example/p.jpg")).toEqual(["https://images.example/p.jpg"]);
  });
});

/** Google's robots.txt precedence: the longest matching rule wins; Allow wins a tie. `*` matches anything. */
function crawlable(robots, path) {
  const rules = robots
    .split("\n")
    .map((line) => /^(Allow|Disallow): (.+)$/.exec(line))
    .filter(Boolean)
    .map(([, kind, pattern]) => ({ allow: kind === "Allow", pattern }));
  let best = { length: -1, allow: true };
  for (const { allow, pattern } of rules) {
    const regex = new RegExp(`^${pattern.split("*").map((part) => part.replace(/[.?+^${}()|[\]\\]/g, "\\$&")).join(".*")}`);
    if (regex.test(path) && (pattern.length > best.length || (pattern.length === best.length && allow))) best = { length: pattern.length, allow };
  }
  return best.allow;
}

describe("robots.txt", () => {
  const robots = robotsTxt(tenant);

  it("lets crawlers reach products, plain listings and every page of them", () => {
    for (const path of [
      "/",
      "/products",
      "/products?page=2",
      "/categories",
      "/categories/banarasi",
      "/categories/banarasi?page=3",
      "/products/banarasi-red",
      "/products/banarasi-red?color=teal",
      "/guides/silk-care",
      "/request-quote",
      "/faq",
    ]) {
      expect(crawlable(robots, path), path).toBe(true);
    }
  });

  it("keeps them out of filter, sort and search variations, carts, accounts and the admin", () => {
    for (const path of [
      "/products?q=silk",
      "/products?fabric=Silk",
      "/products?sort=popular",
      "/products?page=2&sort=newest",
      "/products?category=banarasi",
      "/categories/banarasi?color=Red",
      "/categories/banarasi?page=2&min=500",
      "/search?q=silk",
      "/request-quote?product=banarasi-red",
      "/cart",
      "/checkout",
      "/wishlist",
      "/account/login?next=/wishlist",
      "/admin",
      "/api/v1/catalog/feed",
      "/newsletter/confirm?token=x",
    ]) {
      expect(crawlable(robots, path), path).toBe(false);
    }
  });

  it("points to the sitemap on the primary domain, and blocks hosts without a store", () => {
    expect(robots).toContain("Sitemap: https://silks.example/sitemap.xml");
    expect(robotsTxt(null)).toBe("User-agent: *\nDisallow: /\n");
  });
});

describe("sitemaps", () => {
  it("escapes URLs and adds the image namespace only when there are images", () => {
    const xml = urlSet([{ loc: "https://silks.example/products/a&b", lastmod: "2026-11-01T10:00:00Z", images: [`${CLOUD}/v1/a.jpg?x=1&y=2`] }]);
    expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
    expect(xml).toContain("<loc>https://silks.example/products/a&#38;b</loc><lastmod>2026-11-01T10:00:00Z</lastmod>");
    expect(xml).toContain("<image:image><image:loc>https://res.cloudinary.com/demo/image/upload/v1/a.jpg?x=1&#38;y=2</image:loc></image:image>");
    expect(urlSet([{ loc: "https://silks.example/" }])).not.toContain("xmlns:image");
  });
});

describe("page metadata", () => {
  it("gives every page an absolute canonical and complete Open Graph and X cards", () => {
    const metadata = pageMetadata(tenant, { title: "Banarasi", description: "Shop Banarasi.", path: "/categories/banarasi" });
    expect(metadata.alternates).toEqual({ canonical: "https://silks.example/categories/banarasi" });
    expect(metadata.robots).toMatchObject({ index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 });
    expect(metadata.openGraph).toMatchObject({
      type: "website",
      siteName: "Silk House",
      locale: "en_IN",
      url: "https://silks.example/categories/banarasi",
      title: "Banarasi",
      description: "Shop Banarasi.",
    });
    // No page image: the store's own image (its logo here), as a share card.
    expect(metadata.openGraph.images[0].url).toBe(`${CLOUD}/c_pad,w_1200,h_630,b_auto,f_jpg,q_auto/v1/brand/logo.png`);
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image", site: "@silkhouse", title: "Banarasi" });
  });

  it("leaves the canonical out of pages that aren't indexed", () => {
    const metadata = pageMetadata(tenant, { title: "Search: silk", robots: "noindex" });
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });

  it("reads the X handle from x.com and twitter.com profile URLs only", () => {
    expect(xHandle("https://twitter.com/@SilkHouse/")).toBe("@SilkHouse");
    expect(xHandle("https://x.com/silkhouse?lang=en")).toBe("@silkhouse");
    expect(xHandle("https://instagram.com/silkhouse")).toBeUndefined();
  });

  it("uses square icons, a monogram fallback and the store's verification tokens", () => {
    const fallback = rootMetadata(tenant);
    const version = brandIconVersion(tenant);
    expect(fallback.icons.icon.map((icon) => icon.url)).toEqual([48, 96, 192].map((size) => `/icons/icon-${size}.png?v=${version}`));
    expect(fallback.verification).toBeUndefined();
    expect(fallback.title).toEqual({ default: "Silk House", template: "%s | Silk House" });

    const own = rootMetadata({
      ...tenant,
      branding: { ...tenant.branding, faviconUrl: `${CLOUD}/v1/brand/icon.png` },
      seo: { googleSiteVerification: "abc123_XYZ-token", bingSiteVerification: "0123456789ABCDEF" },
    });
    expect(own.icons.icon[0]).toEqual({ url: `${CLOUD}/c_pad,w_48,h_48,b_white,f_png/v1/brand/icon.png`, sizes: "48x48", type: "image/png" });
    expect(own.icons.apple[0].sizes).toBe("180x180");
    expect(own.verification).toEqual({ google: "abc123_XYZ-token", other: { "msvalidate.01": "0123456789ABCDEF" } });
  });

  it("monograms use the first Latin letter, falling back to the slug", () => {
    expect(monogramOf(tenant)).toBe("S");
    expect(monogramOf({ ...tenant, name: "रेशम", branding: { ...tenant.branding, siteTitle: "" }, slug: "resham" })).toBe("R");
  });
});

describe("listing metadata", () => {
  const query = { q: "", category: "", fabric: [], weave: [], occasion: [], color: [], minPrice: null, maxPrice: null, inStock: false, sort: "newest", page: 2 };
  const result = { items: [], total: 120, page: 2, pageCount: 5, priceRange: null, facets: {} };

  it("indexes every page of a plain listing under its own canonical, with prev/next", () => {
    const metadata = listingMetadata(tenant, { basePath: "/products", title: "All products", description: "All.", query, result });
    expect(metadata.title).toBe("All products – Page 2");
    expect(metadata.alternates.canonical).toBe("https://silks.example/products?page=2");
    expect(metadata.pagination).toEqual({ previous: "https://silks.example/products", next: "https://silks.example/products?page=3" });
  });

  it("keeps searches, filters, sorts and empty listings out of the index", () => {
    for (const variation of [{ q: "silk" }, { fabric: ["Silk"] }, { sort: "popular" }, { inStock: true }, { minPrice: 500 }]) {
      const metadata = listingMetadata(tenant, { basePath: "/products", title: "x", description: "x", query: { ...query, ...variation }, result });
      expect(metadata.robots).toEqual({ index: false, follow: true });
      expect(metadata.alternates).toBeUndefined();
    }
    const empty = listingMetadata(tenant, { basePath: "/products", title: "x", description: "x", query, result: { ...result, total: 0, pageCount: 0 } });
    expect(empty.robots).toEqual({ index: false, follow: true });
  });

  it("treats the category in a category page's path as part of the page, not a filter", () => {
    expect(isPlainListing({ ...query, category: "banarasi" }, "/categories/banarasi")).toBe(true);
    expect(isPlainListing({ ...query, category: "banarasi" }, "/products")).toBe(false);
  });
});

describe("product structured data", () => {
  it("marks up a product with its offer, minimum order, shipping, returns and named reviews", () => {
    const data = productJsonLd({ tenant, product, reviews, policies });
    expect(data).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Product",
      "@id": "https://silks.example/products/banarasi-red#product",
      name: "Banarasi Red",
      sku: "BAN-1",
      description: "Pure silk saree. Zari border.",
      url: "https://silks.example/products/banarasi-red",
      brand: { "@type": "Brand", name: "Silk House" },
      category: "Banarasi",
      material: "Silk",
      pattern: "Zari buta",
      aggregateRating: { ratingValue: 4.3, reviewCount: 2, bestRating: 5, worstRating: 1 },
    });
    expect(data.image.slice(0, 3).every((url) => url.includes("c_pad"))).toBe(true);
    expect(data.image).toContain(`${CLOUD}/v1/p/back.jpg`);
    // The anonymous byline isn't a person's name, so that review is left out.
    expect(data.review).toEqual([
      {
        "@type": "Review",
        author: { "@type": "Person", name: "Priya" },
        datePublished: "2026-10-01",
        reviewRating: { "@type": "Rating", ratingValue: 5, bestRating: 5, worstRating: 1 },
        name: "Lovely",
        reviewBody: "Beautiful zari.",
      },
    ]);
    expect(data.offers).toMatchObject({
      "@type": "Offer",
      url: "https://silks.example/products/banarasi-red",
      price: 400,
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      eligibleQuantity: { minValue: 10, unitCode: "C62" },
      hasMerchantReturnPolicy: { applicableCountry: "IN", merchantReturnDays: 7, returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow" },
    });
    // The smallest order (10 × ₹400) is below the free-shipping threshold.
    expect(data.offers.shippingDetails).toMatchObject({
      shippingRate: { value: 150, currency: "INR" },
      shippingDestination: { addressCountry: "IN" },
      deliveryTime: { handlingTime: { minValue: 2, maxValue: 4, unitCode: "DAY" } },
    });
    expect(data.offers.shippingDetails.deliveryTime.transitTime).toBeUndefined();
  });

  it("is out of stock below the minimum order, and has no shipping details without a delivery time", () => {
    const data = productJsonLd({ tenant, product: { ...product, stock: 6 }, reviews: [], policies: { ...policies, dispatchMaxDays: 0 } });
    expect(data.offers.availability).toBe("https://schema.org/OutOfStock");
    expect(data.offers.shippingDetails).toBeUndefined();
    expect(data.review).toBeUndefined();
  });

  it("shows a retail sale as a strikethrough price", () => {
    const data = productJsonLd({ tenant: { ...tenant, salesMode: "retail" }, product: { ...product, minimumQuantity: 1, compareAtPrice: 500 }, reviews: [], policies });
    expect(data.offers.priceSpecification).toEqual({
      "@type": "UnitPriceSpecification",
      priceType: "https://schema.org/StrikethroughPrice",
      price: 500,
      priceCurrency: "INR",
    });
    expect(data.offers.eligibleQuantity).toBeUndefined();
  });

  it("makes a product with colours a ProductGroup whose variants each have their own URL", () => {
    const variants = [
      { id: "v1", colorName: "Red", colorHex: "#f00", sku: "BAN-1-RED", stock: 30, images: [{ url: `${CLOUD}/v1/p/red.jpg`, alt: "Red" }] },
      { id: "v2", colorName: "Red", colorHex: "#e00", sku: "BAN-1-RED2", stock: 4, images: [] },
      { id: "v3", colorName: "Peacock Teal", colorHex: "#088", sku: "BAN-1-TEAL", stock: 12, images: [] },
    ];
    const data = productJsonLd({ tenant, product: { ...product, variants }, reviews, policies });
    expect(data).toMatchObject({ "@type": "ProductGroup", productGroupID: "BAN-1", variesBy: ["https://schema.org/color"] });
    expect(data.sku).toBeUndefined();
    expect(data.hasVariant.map((variant) => [variant.name, variant.sku, variant.offers.url, variant.offers.availability])).toEqual([
      ["Banarasi Red – Red", "BAN-1-RED", "https://silks.example/products/banarasi-red?color=red", "https://schema.org/InStock"],
      ["Banarasi Red – Red", "BAN-1-RED2", "https://silks.example/products/banarasi-red?color=ban-1-red2", "https://schema.org/OutOfStock"],
      ["Banarasi Red – Peacock Teal", "BAN-1-TEAL", "https://silks.example/products/banarasi-red?color=peacock-teal", "https://schema.org/InStock"],
    ]);
    expect(data.hasVariant[0].image).toEqual([`${CLOUD}/v1/p/red.jpg`]);
    expect(data.hasVariant[2].image).toEqual(product.images.map((image) => image.url));
  });

  it("keeps a product with a single colour a Product, sold as that colour", () => {
    const variants = [{ id: "v1", colorName: "Mustard", colorHex: "#cc0", sku: "BAN-1-MUS", stock: 3, images: [] }];
    const data = productJsonLd({ tenant, product: { ...product, variants }, reviews: [], policies });
    expect(data).toMatchObject({ "@type": "Product", sku: "BAN-1-MUS", color: "Mustard" });
    expect(data.hasVariant).toBeUndefined();
    expect(data.offers).toMatchObject({ url: "https://silks.example/products/banarasi-red", availability: "https://schema.org/OutOfStock" });
  });

  it("finds the variant a ?color= link names", () => {
    const variants = [
      { id: "v1", colorName: "Red", sku: "A-1" },
      { id: "v2", colorName: "Red", sku: "A-2" },
    ];
    expect([...variantParamValues(variants).values()]).toEqual(["red", "a-2"]);
    expect(variantFromParam(variants, "RED")?.id).toBe("v1");
    expect(variantFromParam(variants, "a-2")?.id).toBe("v2");
    expect(variantFromParam(variants, "blue")).toBeNull();
    expect(variantFromParam(variants, null)).toBeNull();
  });
});

describe("store structured data", () => {
  it("describes the store as an OnlineStore with contact details, profiles and GSTIN", () => {
    const data = organizationJsonLd(tenant, policies);
    expect(data).toMatchObject({
      "@type": "OnlineStore",
      "@id": "https://silks.example/#organization",
      name: "Silk House",
      url: "https://silks.example/",
      legalName: "Silk House Pvt Ltd",
      telephone: "+919876543210",
      email: "hello@silks.example",
      vatID: "09ABCDE1234F1Z5",
      address: { "@type": "PostalAddress", streetAddress: "12 Weavers Lane, Varanasi", addressCountry: "IN" },
      sameAs: ["https://instagram.com/silkhouse", "https://x.com/silkhouse"],
      logo: { "@type": "ImageObject", url: `${CLOUD}/c_pad,w_512,h_512,b_white,f_png/v1/brand/logo.png` },
    });
    expect(websiteJsonLd(tenant)).toMatchObject({ "@type": "WebSite", name: "Silk House", url: "https://silks.example/", publisher: { "@id": "https://silks.example/#organization" } });
  });

  it("states the return window, or that returns aren't accepted", () => {
    expect(returnPolicyJsonLd("https://silks.example", policies)).toMatchObject({
      returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
      merchantReturnDays: 7,
      returnMethod: "https://schema.org/ReturnByMail",
      merchantReturnLink: "https://silks.example/returns",
    });
    expect(returnPolicyJsonLd("https://silks.example", { ...policies, returnWindowDays: 0 }).returnPolicyCategory).toBe(
      "https://schema.org/MerchantReturnNotPermitted",
    );
  });

  it("models shipping as the checkout charges it: flat, then free from the threshold", () => {
    const service = shippingServiceJsonLd(policies);
    expect(service.handlingTime.duration).toMatchObject({ minValue: 2, maxValue: 4, unitCode: "DAY" });
    expect(service.shippingConditions.map((condition) => [condition.orderValue, condition.shippingRate.value])).toEqual([
      [{ "@type": "MonetaryAmount", currency: "INR", minValue: 0, maxValue: 4999.99 }, 150],
      [{ "@type": "MonetaryAmount", currency: "INR", minValue: 5000 }, 0],
    ]);
    expect(shippingServiceJsonLd({ ...policies, shippingFlatAmount: 0 }).shippingConditions.shippingRate.value).toBe(0);
    expect(shippingServiceJsonLd({ ...policies, shippingFreeThreshold: 0 }).shippingConditions.shippingRate.value).toBe(150);
  });

  it("writes phone numbers with their country code", () => {
    expect(internationalPhone("098765 43210")).toBe("+919876543210");
    expect(internationalPhone("+91 98765-43210")).toBe("+919876543210");
    expect(internationalPhone("919876543210")).toBe("+919876543210");
    expect(internationalPhone("")).toBe("");
  });

  it("builds breadcrumb trails whose last item is the page itself", () => {
    expect(breadcrumbJsonLd("https://silks.example", [{ name: "Catalogue", href: "/products" }, { name: "Banarasi" }])).toEqual({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Catalogue", item: "https://silks.example/products" },
        { "@type": "ListItem", position: 2, name: "Banarasi" },
      ],
    });
  });
});

describe("category tree", () => {
  const categories = [
    { id: "silk", name: "Silk", slug: "silk", parentId: null, productCount: 0, lastModified: "2026-10-01T00:00:00.000Z" },
    { id: "banarasi", name: "Banarasi", slug: "banarasi", parentId: "silk", productCount: 3, lastModified: "2026-11-02T00:00:00.000Z" },
    { id: "kora", name: "Kora", slug: "kora", parentId: "banarasi", productCount: 2, lastModified: "2026-10-15T00:00:00.000Z" },
    { id: "loop", name: "Loop", slug: "loop", parentId: "loop", productCount: 1, lastModified: null },
  ];

  it("counts subcategories' products and their latest change into each parent", () => {
    const totals = subtreeTotals(categories);
    expect(totals.get("silk")).toEqual({ productCount: 5, lastModified: "2026-11-02T00:00:00.000Z" });
    expect(totals.get("banarasi").productCount).toBe(5);
    expect(totals.get("kora").productCount).toBe(2);
    expect(totals.get("loop").productCount).toBe(1);
  });

  it("lists a category's ancestors root first, and survives a parent cycle", () => {
    expect(categoryTrail(categories, "kora").map((category) => category.slug)).toEqual(["silk", "banarasi", "kora"]);
    expect(categoryTrail(categories, "loop").map((category) => category.slug)).toEqual(["loop"]);
    expect(categoryTrail(categories, "missing")).toEqual([]);
  });
});

describe("renamed products and categories", () => {
  it("remembers old slugs for redirects, without the current one", () => {
    expect(rememberSlug(["a"], "b", "c")).toEqual(["a", "b"]);
    expect(rememberSlug(["a", "b"], "c", "a")).toEqual(["b", "c"]);
    expect(rememberSlug(undefined, "a", "a")).toEqual([]);
    expect(rememberSlug(Array.from({ length: 25 }, (_, index) => `s${index}`), "old", "new")).toHaveLength(20);
  });
});

describe("generated descriptions", () => {
  it("uses the store's description when there is one, else the product's facts", () => {
    expect(productDescription(tenant, { ...product, seoDescription: "Written by the store." })).toBe("Written by the store.");
    expect(productDescription(tenant, product)).toBe("Banarasi Red – Silk, Kadhwa, Zari buta. ₹400 per piece. Minimum order 10 pieces. Buy online from Silk House.");
  });

  it("names what a category lists", () => {
    expect(categoryDescription(tenant, { name: "Linen Sarees", description: "" }, 1)).toContain("1 design of Linen Sarees wholesale");
    expect(categoryDescription(tenant, { name: "Banarasi", description: "" }, 12)).toContain("12 designs of Banarasi sarees");
    expect(categoryDescription(tenant, { name: "Banarasi", description: "Our weaves." }, 12)).toBe("Our weaves.");
    // A filtered view isn't counted.
    expect(categoryDescription(tenant, { name: "Banarasi", description: "" }, null)).toBe(
      "Buy Banarasi sarees wholesale from Silk House, with per-piece prices and minimum order quantities.",
    );
  });

  it("quotes the store's dispatch time in its default shipping policy", () => {
    expect(dispatchWindow({ dispatchMinDays: 2, dispatchMaxDays: 4 })).toBe("2–4 working days");
    expect(dispatchWindow({ dispatchMinDays: 1, dispatchMaxDays: 1 })).toBe("1 working day");
    expect(dispatchWindow({ dispatchMinDays: 0, dispatchMaxDays: 0 })).toBe("");
    const store = { name: "Silk House", salesMode: "wholesale", contactEmail: "", returnWindowDays: 7, cancellationWindowHours: 48 };
    expect(defaultStorePage("shipping", { ...store, dispatchMinDays: 1, dispatchMaxDays: 3 }).sections[0].body).toMatch(/^Orders are usually dispatched within 1–3 working days of payment\./);
    expect(defaultStorePage("shipping", store).sections[0].body).toMatch(/^Orders are dispatched as soon as possible after payment\./);
  });
});
