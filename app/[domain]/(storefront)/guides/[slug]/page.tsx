import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { domain } from "next/root-params";
import Paragraphs from "@/components/content/paragraphs";
import Breadcrumbs from "@/components/seo/breadcrumbs";
import JsonLd from "@/components/seo/json-ld";
import { getPublishedGuide, getPublishedGuides } from "@/lib/content/guides";
import { shareImage } from "@/lib/seo/images";
import { pageMetadata } from "@/lib/seo/metadata";
import { articleJsonLd, withContext } from "@/lib/seo/structured-data";
import { storeOrigin } from "@/lib/seo/urls";
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

/** The published guide at this address; anything else shows the not-found page. */
async function load(params: GuidePageProps["params"]) {
  const [{ slug }, tenant] = await Promise.all([params, getCurrentTenant()]);
  const guide = await getPublishedGuide(tenant.id, slug);
  if (!guide) notFound();
  return { tenant, guide };
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { tenant, guide } = await load(params);
  return pageMetadata(tenant, {
    title: guide.title,
    description: guide.excerpt || undefined,
    path: `/guides/${guide.slug}`,
    type: "article",
    publishedTime: guide.publishedAt,
    modifiedTime: guide.updatedAt,
    images: guide.coverImage ? [shareImage(guide.coverImage.url, guide.coverAlt || guide.title)] : undefined,
  });
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { tenant, guide } = await load(params);

  return (
    <main className="guide-article content-width">
      <JsonLd data={withContext(articleJsonLd(tenant, guide))} />
      <Breadcrumbs
        origin={storeOrigin(tenant)}
        crumbs={[{ name: "Home", href: "/" }, { name: "Buying guides", href: "/guides" }, { name: guide.title }]}
      />
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
