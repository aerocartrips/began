import { Fragment, type ReactNode } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import Button from "@/components/ui/button";
import HeroBanner from "@/components/landing/hero-banner";
import HomeSection, { visibilityClass } from "@/components/landing/home-section";
import CategoryRail, { type RailShortcut } from "@/components/landing/category-rail";
import TypeCards from "@/components/landing/type-cards";
import TypeTabs from "@/components/landing/type-tabs";
import TrustStrip from "@/components/landing/trust-strip";
import ForYouRail from "@/components/landing/for-you-rail";
import CatalogueOverview from "@/components/landing/catalogue-overview";
import ProductTabs from "@/components/landing/product-tabs";
import ProductRail from "@/components/catalog/product-rail";
import QuickPicks from "@/components/landing/quick-picks";
import RecentlyViewedRail from "@/components/landing/recently-viewed-rail";
import HomeReviews from "@/components/landing/home-reviews";
import HomeCta from "@/components/landing/home-cta";
import HomeFeed, { type FeedChip } from "@/components/landing/home-feed";
import HomeStructuredData from "@/components/landing/home-structured-data";
import HomeAnalytics from "@/components/landing/home-analytics";
import NewsletterSignup from "@/components/landing/newsletter-signup";
import GuideCard from "@/components/guides/guide-card";
import { getPublishedGuides } from "@/lib/content/guides";
import { getLiveBanners } from "@/lib/content/banners";
import { getHomepageSections } from "@/lib/content/homepage";
import { defaultCta, defaultHomeSections, defaultTrustItems } from "@/lib/content/homepage-defaults";
import {
  getCatalogueTotal,
  getCategoryOverview,
  getCollectionProducts,
  getFeedPage,
  getHomeReviews,
  getPopularProducts,
  getProductTabs,
  getQuickPicks,
  getTypeShowcase,
} from "@/lib/catalog/home";
import { groupByType } from "@/lib/catalog/type-mix";
import { getCategories } from "@/lib/catalog/query";
import { subtreeTotals } from "@/lib/catalog/category-tree";
import { leadsToProducts } from "@/lib/content/banner-links";
import { inSentence } from "@/lib/catalog/words";
import { FEED_PAGE_SIZE, HOME_SECTION_TYPES as T, PRODUCT_TAB_LABELS } from "@/lib/constants/homepage";
import { shareImage } from "@/lib/seo/images";
import { pageMetadata, siteNameOf } from "@/lib/seo/metadata";
import { getCurrentTenant } from "@/lib/tenant/current";
import { logger } from "@/lib/utils/logger";
import type { HomeSection as HomeSectionConfig, ProductTabKey } from "@/features/homepage/types";
import type { PublicTenant } from "@/lib/tenant/types";

const TAB_HREFS: Record<ProductTabKey, string> = {
  bestsellers: "/products?sort=popular",
  new: "/products?sort=newest",
  trending: "/products?sort=popular",
};

/** A failing non-critical section is logged and left out; the rest of the page still renders. */
async function safely<T>(section: string, load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch (error) {
    logger.error("Home page section failed to load", { section, error });
    return fallback;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getCurrentTenant();
  const { tagline, heroImageUrl } = tenant.branding;
  const siteName = siteNameOf(tenant);
  const banners = await safely("banners", () => getLiveBanners(tenant.id), []);
  const banner = banners[0];
  const image = banner ? shareImage(banner.image.url, banner.imageAlt || banner.title) : heroImageUrl ? shareImage(heroImageUrl, siteName) : null;
  return pageMetadata(tenant, {
    // The home page title carries the site name and what the store is about.
    title: tagline ? `${siteName} – ${tagline}` : siteName,
    absoluteTitle: true,
    path: "/",
    images: image ? [image] : undefined,
  });
}

/** Store headline and hero image, shown when the store has no live banners. */
function StoreHero({ tenant }: { tenant: PublicTenant }) {
  const { siteTitle, tagline, description, heroImageUrl } = tenant.branding;
  return (
    <header className="hero">
      <div className="hero-grid content-width">
        <div className="hero-copy">
          <h1>{tagline || siteTitle}</h1>
          {description ? <p className="hero-description">{description}</p> : null}
          <div className="hero-actions">
            <Button href="/products" icon={<ArrowRight size={15} aria-hidden="true" />}>
              Shop the catalogue
            </Button>
            {tenant.salesMode === "wholesale" ? (
              <Button href="/request-quote" variant="secondary">
                Request a quote
              </Button>
            ) : null}
          </div>
        </div>
        {heroImageUrl ? (
          <div className="hero-visual">
            <div className="hero-image-frame">
              <Image
                src={heroImageUrl}
                alt=""
                fill
                loading="eager"
                fetchPriority="high"
                sizes="(max-width: 760px) 92vw, (max-width: 1100px) 70vw, 45vw"
                className="cover-image hero-image"
              />
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}

function collectionViewAll(section: HomeSectionConfig) {
  if (section.viewAllHref) return section.viewAllHref;
  const source = section.source;
  if (!source?.value) return "";
  if (source.kind === "category") return `/categories/${source.value}`;
  if (source.kind === "type") return `/shop/${source.value}`;
  if (source.kind === "products") return "";
  // Attribute collections (older ones used the attribute key as their kind) open the filtered catalogue.
  const key = source.kind === "attribute" ? source.attribute : source.kind;
  return key ? `/products?${new URLSearchParams({ [key]: source.value })}` : "";
}

export default async function Home() {
  const tenant = await getCurrentTenant();
  const { salesMode } = tenant;
  const sections = await safely("layout", () => getHomepageSections(tenant.id), defaultHomeSections());
  const find = (type: string) => sections.find((section) => section.type === type);
  const tabsSection = find(T.PRODUCT_TABS);
  const forYouSection = find(T.FOR_YOU);
  const reviewsSection = find(T.REVIEWS);
  const guidesSection = find(T.GUIDES);
  const feedSection = find(T.FEED);
  const typesSection = find(T.SHOP_BY_TYPE);
  const collectionSections = sections.filter((section) => section.type === T.COLLECTION && section.source);
  const needsCategories = Boolean(find(T.CATEGORY_NAV) || find(T.CATALOGUE) || feedSection);
  // What the store sells shapes the page: shortcuts, "Shop by type", category groups and feed chips.
  const needsTypes = Boolean(typesSection || needsCategories);
  // "View all" counts for rows that lead to the whole catalogue.
  const needsTotal = Boolean(tabsSection || forYouSection || feedSection);

  // Everything is fetched in parallel, and only for sections the store shows.
  const [banners, categories, tabs, popular, quickPicks, reviews, guides, feed, catalogueTotal, collections, types, linkCategories] = await Promise.all([
    find(T.HERO) ? safely("banners", () => getLiveBanners(tenant.id), []) : [],
    needsCategories ? safely("categories", () => getCategoryOverview(tenant.id, salesMode), []) : [],
    tabsSection ? safely("product tabs", () => getProductTabs(tenant.id, salesMode, tabsSection.limit), null) : null,
    forYouSection ? safely("popular", () => getPopularProducts(tenant.id, salesMode, forYouSection.limit), []) : [],
    find(T.QUICK_PICKS) ? safely("quick picks", () => getQuickPicks(tenant.id, salesMode), []) : [],
    reviewsSection ? safely("reviews", () => getHomeReviews(tenant.id, reviewsSection.limit), []) : [],
    guidesSection ? safely("guides", () => getPublishedGuides(tenant.id, { limit: guidesSection.limit, withCover: true }), []) : [],
    feedSection ? safely("feed", () => getFeedPage(tenant.id, salesMode, {}, null), null) : null,
    needsTotal ? safely("catalogue total", () => getCatalogueTotal(tenant.id), 0) : 0,
    Promise.all(
      collectionSections.map((section) =>
        safely(`collection ${section.key}`, () => getCollectionProducts(tenant.id, salesMode, section.source!, section.limit), { items: [], total: 0 }),
      ),
    ),
    needsTypes ? safely("types", () => getTypeShowcase(tenant.id, salesMode, typesSection?.limit ?? 10), []) : [],
    // Which categories have products on sale, to leave out hero slides that lead to an empty one.
    find(T.HERO) ? safely("banner links", () => getCategories(tenant.id), null) : null,
  ]);
  const collectionProducts = new Map(collectionSections.map((section, index) => [section.key, collections[index]]));

  /*
   * One product type: the page is about it (categories, its feed). Two or three:
   * a photo card and a row for each. Four or more: the shortcuts become the
   * types and "Shop by type" becomes one tabbed row. Categories are grouped
   * under the type their products are (lib/catalog/type-mix.js).
   */
  const multiType = types.length > 1;
  const manyTypes = types.length >= 4;
  const categoryGroups = multiType ? groupByType(categories, types) : [];
  const orderedCategories = multiType ? categoryGroups.flatMap((group) => group.items) : categories;

  const categoryTotals = linkCategories ? subtreeTotals(linkCategories) : null;
  const stockedCategories = linkCategories
    ? new Set(linkCategories.filter((category) => (categoryTotals?.get(category.id)?.productCount ?? 0) > 0).map((category) => category.slug))
    : null;
  const liveBanners = banners.filter(
    (banner) => !banner.primaryCta || leadsToProducts(banner.primaryCta.href, stockedCategories, needsTypes ? new Set(types.map((type) => type.slug)) : null),
  );
  // A catalogue that fits in the feed's first batch: rows of "popular" or "new" would repeat the same products.
  const fitsInFeed = Boolean(feedSection) && catalogueTotal > 0 && catalogueTotal <= FEED_PAGE_SIZE;

  function render(section: HomeSectionConfig): ReactNode {
    switch (section.type) {
      case T.CATEGORY_NAV: {
        // Four or more types: the types. Two or three: the types first, then their categories. One: its categories.
        const typeItems: RailShortcut[] = types.map((type) => ({ id: type.id, name: type.pluralName, href: `/shop/${type.slug}`, image: type.cover }));
        const categoryItems: RailShortcut[] = orderedCategories.map((category) => ({
          id: category.id,
          name: category.name,
          href: `/categories/${category.slug}`,
          image: category.imageUrl ? { url: category.imageUrl, alt: "" } : category.previews[0] ?? null,
        }));
        const items = manyTypes ? typeItems : multiType ? [...typeItems, ...categoryItems] : categoryItems;
        const label = manyTypes ? "Shop by type" : multiType ? "Shop by type and category" : "Shop by category";
        return items.length > 1 ? <CategoryRail section={section} items={items} label={label} /> : null;
      }

      case T.SHOP_BY_TYPE: {
        if (!multiType) return null;
        const title = section.title || "Shop by type";
        if (manyTypes) {
          const headingId = `home-${section.key}`;
          return (
            <section
              className={["home-section content-width", visibilityClass(section)].filter(Boolean).join(" ")}
              aria-labelledby={headingId}
              data-home-section={section.key}
            >
              <TypeTabs
                sectionKey={section.key}
                headingId={headingId}
                title={title}
                description={section.description}
                types={types.map((type) => ({ slug: type.slug, name: type.pluralName, count: type.productCount }))}
                // "All", open first: a card per type ("Popular right now" already mixes their products).
                allPanel={<TypeCards types={types} salesMode={salesMode} layout="row" />}
                limit={section.limit}
                salesMode={salesMode}
              />
            </section>
          );
        }
        return (
          <>
            <HomeSection section={section} title={title} description={section.description}>
              <TypeCards types={types} salesMode={salesMode} />
            </HomeSection>
            {types.map((type) =>
              type.products.length ? (
                <HomeSection
                  key={type.id}
                  section={{ ...section, key: `${section.key}-${type.slug}` }}
                  title={type.pluralName}
                  viewAll={{ href: `/shop/${type.slug}`, label: `All ${inSentence(type.pluralName)}` }}
                >
                  <ProductRail products={type.products} salesMode={salesMode} label={type.pluralName} viewAll={{ href: `/shop/${type.slug}`, count: type.productCount }} />
                </HomeSection>
              ) : null,
            )}
          </>
        );
      }

      case T.HERO: {
        const hero = liveBanners.length ? <HeroBanner banners={liveBanners} storeName={tenant.name} /> : <StoreHero tenant={tenant} />;
        return (
          <div className={visibilityClass(section) || undefined} data-home-section={section.key}>
            {hero}
          </div>
        );
      }

      case T.TRUST:
        return <TrustStrip section={section} items={section.items?.length ? section.items : defaultTrustItems(salesMode)} storeName={tenant.name} />;

      case T.FOR_YOU:
        if (fitsInFeed) return null;
        return <ForYouRail section={section} initialProducts={popular} catalogueTotal={catalogueTotal} salesMode={salesMode} />;

      case T.CATALOGUE: {
        // One category: nothing to explore (the feed below lists it).
        if (categories.length < 2) return null;
        if (categoryGroups.length > 1) {
          // "All" first (every category, type by type), then a tab per type and "Collections" for categories that mix types.
          const headingId = `home-${section.key}`;
          return (
            <section
              className={["home-section content-width", visibilityClass(section)].filter(Boolean).join(" ")}
              aria-labelledby={headingId}
              data-home-section={section.key}
            >
              <ProductTabs
                headingId={headingId}
                title={section.title || "Explore the collection"}
                description={section.description}
                tabs={[
                  {
                    key: "all",
                    label: "All",
                    href: section.viewAllHref || "/categories",
                    panel: <CatalogueOverview categories={orderedCategories} salesMode={salesMode} listId="catalogue-all" />,
                  },
                  ...categoryGroups.map((group) => {
                    const type = types.find((entry) => entry.id === group.typeId);
                    const key = type?.slug ?? "collections";
                    return {
                      key,
                      label: type?.pluralName ?? "Collections",
                      href: type ? `/shop/${type.slug}` : section.viewAllHref || "/categories",
                      panel: <CatalogueOverview categories={group.items} salesMode={salesMode} listId={`catalogue-${key}`} />,
                    };
                  }),
                ]}
              />
            </section>
          );
        }
        return (
          <HomeSection
            section={section}
            title={section.title || "Explore the collection"}
            description={section.description}
            viewAll={{ href: section.viewAllHref || "/categories", label: "All categories" }}
          >
            <CatalogueOverview categories={categories} salesMode={salesMode} />
          </HomeSection>
        );
      }

      case T.PRODUCT_TABS: {
        if (fitsInFeed) return null;
        const available = (section.tabs ?? (["bestsellers", "new", "trending"] as ProductTabKey[])).filter((key) => tabs?.[key].length);
        if (!tabs || !available.length) return null;
        const headingId = `home-${section.key}`;
        return (
          <section
            className={["home-section content-width", visibilityClass(section)].filter(Boolean).join(" ")}
            aria-labelledby={headingId}
            data-home-section={section.key}
          >
            <ProductTabs
              headingId={headingId}
              title={section.title || "Shop the edit"}
              description={section.description}
              tabs={available.map((key) => ({
                key,
                label: PRODUCT_TAB_LABELS[key],
                href: TAB_HREFS[key],
                panel: (
                  <ProductRail
                    products={tabs[key]}
                    salesMode={salesMode}
                    label={PRODUCT_TAB_LABELS[key]}
                    viewAll={{ href: TAB_HREFS[key], count: catalogueTotal }}
                  />
                ),
              }))}
            />
          </section>
        );
      }

      case T.QUICK_PICKS:
        return quickPicks.length ? (
          <HomeSection section={section} title={section.title || "Find it faster"} description={section.description}>
            <QuickPicks groups={quickPicks} />
          </HomeSection>
        ) : null;

      case T.COLLECTION: {
        const products = collectionProducts.get(section.key);
        const href = collectionViewAll(section);
        // A custom link may list something else, so only the collection's own page gets a count.
        const viewAll = href ? { href, count: section.viewAllHref ? null : products?.total } : null;
        return products?.items.length ? (
          <HomeSection section={section} title={section.title} description={section.description} viewAll={viewAll}>
            <ProductRail products={products.items} salesMode={salesMode} label={section.title} viewAll={viewAll} />
          </HomeSection>
        ) : null;
      }

      case T.RECENTLY_VIEWED:
        return <RecentlyViewedRail section={section} salesMode={salesMode} />;

      case T.REVIEWS:
        return reviews.length ? (
          <HomeSection section={section} title={section.title || "What our buyers say"} description={section.description}>
            <HomeReviews reviews={reviews} />
          </HomeSection>
        ) : null;

      case T.CTA: {
        const fallback = defaultCta(salesMode);
        return (
          <HomeCta
            section={section}
            title={section.title || fallback.title}
            description={section.description || fallback.description}
            primaryCta={section.primaryCta?.href ? section.primaryCta : fallback.primaryCta}
            secondaryCta={section.secondaryCta?.href ? section.secondaryCta : section.primaryCta?.href ? null : fallback.secondaryCta}
          />
        );
      }

      case T.GUIDES:
        return guides.length ? (
          <HomeSection
            section={section}
            title={section.title || "Buying guides"}
            description={section.description}
            viewAll={{ href: section.viewAllHref || "/guides", label: "All guides" }}
          >
            <ul className="guide-rail">
              {guides.map((guide) => (
                <li key={guide.id}>
                  <GuideCard guide={guide} />
                </li>
              ))}
            </ul>
          </HomeSection>
        ) : null;

      case T.NEWSLETTER:
        return (
          <NewsletterSignup
            section={section}
            title={section.title || "New arrivals in your inbox"}
            description={section.description}
          />
        );

      case T.FEED: {
        if (!feed?.items.length) return null;
        // Several types: the chips are the types (the feed takes turns between them); one type: its categories.
        const chips: FeedChip[] = multiType
          ? types.map((type) => ({ key: type.slug, name: type.pluralName, count: type.productCount, param: "type", href: `/shop/${type.slug}` }))
          : categories.map(({ slug, name, productCount }) => ({ key: slug, name, count: productCount, param: "category", href: `/categories/${slug}` }));
        return (
          <HomeFeed
            section={section}
            title={section.title || "All products"}
            description={
              section.description ||
              (multiType ? "Most popular first, every type in turn. Pick a type to narrow it down." : "Most popular first. Pick a category to narrow it down.")
            }
            initialPage={feed}
            chips={chips}
            catalogueTotal={catalogueTotal}
            salesMode={salesMode}
          />
        );
      }

      default:
        return null;
    }
  }

  return (
    <main id="main-content" className="home-page">
      <HomeStructuredData tenant={tenant} />
      <HomeAnalytics rootId="main-content" />
      {sections.map((section) => (
        <Fragment key={section.key}>{render(section)}</Fragment>
      ))}
    </main>
  );
}
