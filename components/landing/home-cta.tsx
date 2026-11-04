import Button from "@/components/ui/button";
import type { HomeLink, HomeSection } from "@/features/homepage/types";
import { visibilityClass } from "@/components/landing/home-section";

/** Full-width call to action (bulk orders, quotes or enquiries). */
export default function HomeCta({ section, title, description, primaryCta, secondaryCta }: {
  section: HomeSection;
  title: string;
  description: string;
  primaryCta?: HomeLink | null;
  secondaryCta?: HomeLink | null;
}) {
  const headingId = `home-${section.key}`;
  return (
    <section className={["home-cta content-width", visibilityClass(section)].filter(Boolean).join(" ")} aria-labelledby={headingId} data-home-section={section.key}>
      <div>
        <h2 id={headingId}>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {primaryCta?.href || secondaryCta?.href ? (
        <div className="home-cta__actions">
          {primaryCta?.href ? <Button href={primaryCta.href}>{primaryCta.label}</Button> : null}
          {secondaryCta?.href ? (
            <Button href={secondaryCta.href} variant="secondary">
              {secondaryCta.label}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
