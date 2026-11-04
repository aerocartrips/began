import { Fragment, type ReactNode } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import Button from "@/components/ui/button";
import HeroBanner from "@/components/landing/hero-banner";
import HomeSection, { visibilityClass } from "@/components/landing/home-section";
import CategoryRail from "@/components/landing/category-rail";
import TrustStrip from "@/components/landing/trust-strip";
import ForYouRail from "@/components/landing/for-you-rail";
import CatalogueOverview from "@/components/landing/catalogue-overview";
import ProductTabs from "@/components/landing/product-tabs";
import ProductRail from "@/components/landing/product-rail";
import QuickPicks from "@/components/landing/quick-picks";
import RecentlyViewedRail from "@/components/landing/recently-viewed-rail";
import HomeReviews from "@/components/landing/home-reviews";
import HomeCta from "@/components/landing/home-cta";
import HomeFeed from "@/components/landing/home-feed";
import HomeStructuredData from "@/components/landing/home-structured-data";
import HomeAnalytics from "@/components/landing/home-analytics";
import NewsletterSignup from "@/components/landing/newsletter-signup";
import GuideCard from "@/components/guides/guide-card";
import { getPublishedGuides } from "@/lib/content/guides";
import { getLiveBanners } from "@/lib/content/banners";
import { getHomepageSections } from "@/lib/content/homepage";
import { defaultCta, defaultHomeSections, defaultTrustItems } from "@/lib/content/homepage-defaults";
import {
  getCategoryOverview,
  getCollectionProducts,
  getFeedPage,
  getHomeReviews,
  getPopularProducts,
  getProductTabs,
  getQuickPicks,
} from "@/lib/catalog/home";
import { HOME_SECTION_TYPES as T, PRODUCT_TAB_LABELS } from "@/lib/constants/homepage";
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
  const { siteTitle, tagline, description, heroImageUrl } = tenant.branding;
  const banners = await safely("banners", () => getLiveBanners(tenant.id), []);
  const title = tagline ? `${siteTitle} – ${tagline}` : siteTitle;
  const image = banners[0]?.image.url || heroImageUrl;
  return {
    title: { absolute: title },
    description: description || undefined,
    alternates: { canonical: "/" },
    openGraph: { title, description: description || undefined, url: "/", type: "website", images: image ? [{ url: image }] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title, description: description || undefined, images: image ? [image] : undefined },
  };
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
                priority
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
  if (source.kind === "products") return "";
  return `/products?${new URLSearchParams({ [source.kind]: source.value })}`;
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
  const collectionSections = sections.filter((section) => section.type === T.COLLECTION && section.source);
  const needsCategories = Boolean(find(T.CATEGORY_NAV) || find(T.CATALOGUE) || find(T.FEED));

  // Everything is fetched in parallel, and only for sections the store shows.
  const [banners, categories, tabs, popular, quickPicks, reviews, guides, feed, collections] = await Promise.all([
    find(T.HERO) ? safely("banners", () => getLiveBanners(tenant.id), []) : [],
    needsCategories ? safely("categories", () => getCategoryOverview(tenant.id, salesMode), []) : [],
    tabsSection ? safely("product tabs", () => getProductTabs(tenant.id, salesMode, tabsSection.limit), null) : null,
    forYouSection ? safely("popular", () => getPopularProducts(tenant.id, salesMode, forYouSection.limit), []) : [],
    find(T.QUICK_PICKS) ? safely("quick picks", () => getQuickPicks(tenant.id, salesMode), []) : [],
    reviewsSection ? safely("reviews", () => getHomeReviews(tenant.id, reviewsSection.limit), []) : [],
    guidesSection ? safely("guides", () => getPublishedGuides(tenant.id, { limit: guidesSection.limit, withCover: true }), []) : [],
    find(T.FEED) ? safely("feed", () => getFeedPage(tenant.id, salesMode, "", null), null) : null,
    Promise.all(
      collectionSections.map((section) =>
        safely(`collection ${section.key}`, () => getCollectionProducts(tenant.id, salesMode, section.source!, section.limit), []),
      ),
    ),
  ]);
  const collectionProducts = new Map(collectionSections.map((section, index) => [section.key, collections[index]]));

  function render(section: HomeSectionConfig): ReactNode {
    switch (section.type) {
      case T.CATEGORY_NAV:
        return categories.length > 1 ? <CategoryRail section={section} categories={categories} /> : null;

      case T.HERO: {
        const hero = banners.length ? <HeroBanner banners={banners} storeName={tenant.name} /> : <StoreHero tenant={tenant} />;
        return (
          <div className={visibilityClass(section) || undefined} data-home-section={section.key}>
            {hero}
          </div>
        );
      }

      case T.TRUST:
        return <TrustStrip section={section} items={section.items?.length ? section.items : defaultTrustItems(salesMode)} storeName={tenant.name} />;

      case T.FOR_YOU:
        return <ForYouRail section={section} initialProducts={popular} salesMode={salesMode} />;

      case T.CATALOGUE:
        return categories.length ? (
          <HomeSection
            section={section}
            title={section.title || "Explore the collection"}
            description={section.description}
            viewAll={{ href: section.viewAllHref || "/categories", label: "All categories" }}
          >
            <CatalogueOverview categories={categories} salesMode={salesMode} />
          </HomeSection>
        ) : null;

      case T.PRODUCT_TABS: {
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
                panel: <ProductRail products={tabs[key]} salesMode={salesMode} label={PRODUCT_TAB_LABELS[key]} />,
              }))}
            />
          </section>
        );
      }

      case T.QUICK_PICKS:
        return quickPicks.length ? (
          <HomeSection section={section} title={section.title || "Find your saree faster"} description={section.description}>
            <QuickPicks groups={quickPicks} />
          </HomeSection>
        ) : null;

      case T.COLLECTION: {
        const products = collectionProducts.get(section.key) ?? [];
        const href = collectionViewAll(section);
        return products.length ? (
          <HomeSection section={section} title={section.title} description={section.description} viewAll={href ? { href } : null}>
            <ProductRail products={products} salesMode={salesMode} label={section.title} />
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

      case T.FEED:
        return feed?.items.length ? (
          <HomeFeed
            section={section}
            title={section.title || "All sarees"}
            description={section.description || "Most popular first. Pick a category to narrow it down."}
            initialPage={feed}
            categories={categories.map(({ slug, name, productCount }) => ({ slug, name, count: productCount }))}
            salesMode={salesMode}
          />
        ) : null;

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
