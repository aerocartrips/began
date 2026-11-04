import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { HomeSection as HomeSectionConfig } from "@/features/homepage/types";

/** Device visibility chosen in Admin → Home page. */
export function visibilityClass(section: Pick<HomeSectionConfig, "showOnMobile" | "showOnDesktop">) {
  if (!section.showOnMobile) return "home-hide-mobile";
  if (!section.showOnDesktop) return "home-hide-desktop";
  return "";
}

type HomeSectionProps = {
  section: Pick<HomeSectionConfig, "key" | "showOnMobile" | "showOnDesktop">;
  title: string;
  description?: string;
  viewAll?: { href: string; label?: string } | null;
  className?: string;
  children: ReactNode;
};

/** Heading row (title, optional line, "View all") plus content, for every home page row. */
export default function HomeSection({ section, title, description, viewAll, className = "", children }: HomeSectionProps) {
  const headingId = `home-${section.key}`;
  return (
    <section className={["home-section content-width", visibilityClass(section), className].filter(Boolean).join(" ")} aria-labelledby={headingId} data-home-section={section.key}>
      <div className="home-section__head">
        <div>
          <h2 id={headingId}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {viewAll?.href ? (
          <Link className="home-section__more" href={viewAll.href}>
            {viewAll.label ?? "View all"}
            <ArrowRight size={14} aria-hidden="true" />
            <span className="sr-only"> {title}</span>
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}
