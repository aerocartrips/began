import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { domain } from "next/root-params";
import Paragraphs from "@/components/content/paragraphs";
import JsonLd from "@/components/seo/json-ld";
import { getPublishedGuide, getPublishedGuides } from "@/lib/content/guides";
import { getCurrentTenant } from "@/lib/tenant/current";
import { BUILD_PLACEHOLDER_DOMAIN } from "@/lib/tenant/host";

type GuidePageProps = { params: Promise<{ slug: string }> };

/** Prerender published guides; new ones render on first visit and are cached. */
export async function generateStaticParams() {
  if ((await domain()) === BUILD_PLACEHOLDER_DOMAIN) return [{ slug: "placeholder" }];
  const tenant = await getCurrentTenant();
  const guides = await getPublishedGuides(tenant.id);
  return (guides.length ? guides.map((guide) => guide.slug) : ["placeholder"]).map((slug) => ({ slug }));
}

async function load(params: GuidePageProps["params"]) {
  const [{ slug }, tenant] = await Promise.all([params, getCurrentTenant()]);
  return { tenant, guide: await getPublishedGuide(tenant.id, slug) };
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { guide } = await load(params);
  if (!guide) return { title: "Guide not found" };
  return {
    title: guide.title,
    description: guide.excerpt || undefined,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: {
      type: "article",
      title: guide.title,
      description: guide.excerpt || undefined,
      publishedTime: guide.publishedAt,
      modifiedTime: guide.updatedAt,
      images: guide.coverImage ? [{ url: guide.coverImage.url, alt: guide.coverAlt }] : undefined,
    },
  };
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { tenant, guide } = await load(params);
  if (!guide) notFound();
  const origin = `https://${tenant.primaryDomain}`;

  return (
    <main className="guide-article content-width">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: guide.title,
            ...(guide.excerpt ? { description: guide.excerpt } : {}),
            ...(guide.coverImage ? { image: [guide.coverImage.url] } : {}),
            datePublished: guide.publishedAt,
            dateModified: guide.updatedAt,
            author: { "@type": "Organization", name: tenant.name, url: origin },
            publisher: { "@type": "Organization", name: tenant.name, ...(tenant.branding.logoUrl ? { logo: { "@type": "ImageObject", url: tenant.branding.logoUrl } } : {}) },
            mainEntityOfPage: `${origin}/guides/${guide.slug}`,
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
              { "@type": "ListItem", position: 2, name: "Buying guides", item: `${origin}/guides` },
              { "@type": "ListItem", position: 3, name: guide.title },
            ],
          },
        ]}
      />
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/guides">Buying guides</Link>
      </nav>
      <header className="guide-article__header">
        <h1>{guide.title}</h1>
        {guide.excerpt ? <p className="guide-article__excerpt">{guide.excerpt}</p> : null}
        <p className="guide-article__meta">
          <time dateTime={guide.publishedAt}>
            {new Date(guide.publishedAt).toLocaleDateString("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" })}
          </time>{" "}
          · {guide.readingMinutes} min read
        </p>
      </header>
      {guide.coverImage ? (
        <div className="guide-article__cover">
          <Image src={guide.coverImage.url} alt={guide.coverAlt} fill priority sizes="(max-width: 900px) 100vw, 860px" className="cover-image" />
        </div>
      ) : null}
      <div className="guide-article__body">
        {guide.sections.map((section, index) => (
          <section key={`${index}-${section.heading}`}>
            <h2>{section.heading}</h2>
            <Paragraphs text={section.body} />
          </section>
        ))}
      </div>
      <p className="guide-article__more">
        <Link href="/guides">More buying guides</Link> · <Link href="/products">Shop the catalogue</Link>
      </p>
    </main>
  );
}
