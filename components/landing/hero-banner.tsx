import type { CSSProperties } from "react";
import Link from "next/link";
import { getImageProps } from "next/image";
import { ArrowRight } from "lucide-react";
import HeroBannerController from "@/components/landing/hero-banner-controller";
import type { BannerLink, StorefrontBanner } from "@/features/banners/types";

const isExternal = (href: string) => href.startsWith("https://");

function Cta({ link, variant }: { link: BannerLink; variant: "primary" | "secondary" }) {
  const className = `hero-banner__cta hero-banner__cta--${variant}`;
  const content = (
    <>
      {link.label}
      {variant === "primary" ? <ArrowRight size={16} aria-hidden="true" /> : null}
    </>
  );
  return isExternal(link.href) ? (
    <a className={className} href={link.href} rel="noopener noreferrer" target="_blank">{content}</a>
  ) : (
    <Link className={className} href={link.href}>{content}</Link>
  );
}

/** Art-directed image: a portrait crop on phones when the store provides one. */
function SlideImage({ banner, priority }: { banner: StorefrontBanner; priority: boolean }) {
  // First slide is the LCP image (high priority). Later slides load eagerly at low
  // priority: they download after the critical content but are ready before autoplay
  // reaches them, so a slide never arrives blank.
  const common = {
    alt: banner.imageAlt,
    sizes: "(max-width: 1320px) 100vw, 1280px",
    quality: 80,
    ...(priority ? { priority: true } : { loading: "eager" as const, fetchPriority: "low" as const }),
  };
  const { props: desktop } = getImageProps({ ...common, src: banner.image.url, width: banner.image.width, height: banner.image.height });
  const mobile = banner.mobileImage
    ? getImageProps({ ...common, src: banner.mobileImage.url, width: banner.mobileImage.width, height: banner.mobileImage.height, sizes: "100vw" }).props
    : null;

  return (
    <picture>
      {mobile ? <source media="(max-width: 767px)" srcSet={mobile.srcSet} sizes="100vw" /> : null}
      <img {...desktop} alt={banner.imageAlt} className="hero-banner__image" />
    </picture>
  );
}

/**
 * Home page hero carousel. Slides are server-rendered (headline and first image
 * in the initial HTML, so the LCP image loads immediately); a small client
 * controller adds autoplay, navigation and keyboard support.
 */
export default function HeroBanner({ banners, storeName }: { banners: StorefrontBanner[]; storeName: string }) {
  return (
    <section className="hero-banner content-width" aria-roledescription="carousel" aria-label={`${storeName} highlights`}>
      <HeroBannerController count={banners.length}>
        {banners.map((banner, index) => {
          const Heading = index === 0 ? "h1" : "h2";
          return (
            <li
              key={banner.id}
              className="hero-banner__slide"
              data-active={index === 0 ? "true" : undefined}
              data-tone={banner.textTone}
              data-position={banner.textPosition}
              data-banner-id={banner.id}
              style={{ "--banner-overlay": banner.overlayOpacity / 100 } as CSSProperties}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${banners.length}`}
            >
              <SlideImage banner={banner} priority={index === 0} />
              <div className="hero-banner__content">
                {banner.eyebrow ? <p className="hero-banner__eyebrow">{banner.eyebrow}</p> : null}
                <Heading className="hero-banner__title">{banner.title}</Heading>
                {banner.subtitle ? <p className="hero-banner__subtitle">{banner.subtitle}</p> : null}
                {banner.primaryCta || banner.secondaryCta ? (
                  <div className="hero-banner__actions">
                    {banner.primaryCta ? <Cta link={banner.primaryCta} variant="primary" /> : null}
                    {banner.secondaryCta ? <Cta link={banner.secondaryCta} variant="secondary" /> : null}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </HeroBannerController>
    </section>
  );
}
