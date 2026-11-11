import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStorePage } from "@/lib/content/pages";
import { pageMetadata } from "@/lib/seo/metadata";
import { faqJsonLd, withContext } from "@/lib/seo/structured-data";
import { getCurrentTenant } from "@/lib/tenant/current";
import JsonLd from "@/components/seo/json-ld";
import Paragraphs from "@/components/content/paragraphs";

async function loadPage(slug: string) {
  const tenant = await getCurrentTenant();
  const page = await getStorePage(tenant.id, slug);
  if (!page) notFound();
  return { tenant, page };
}

export async function storePageMetadata(slug: string): Promise<Metadata> {
  const { tenant, page } = await loadPage(slug);
  return pageMetadata(tenant, { title: page.title, description: page.summary || undefined, path: `/${slug}` });
}

export default async function StoreContentPage({ slug }: { slug: string }) {
  const { page } = await loadPage(slug);
  const faqData = page.faqs.length ? withContext(faqJsonLd(page.faqs)) : null;

  return (
    <main className="content-page content-width">
      {faqData ? <JsonLd data={faqData} /> : null}
      <header className="content-page__header">
        <h1>{page.title}</h1>
        {page.summary ? <p>{page.summary}</p> : null}
        {page.updatedAt ? (
          <p className="content-page__updated">Last updated {new Date(page.updatedAt).toLocaleDateString("en-IN", { dateStyle: "long" })}</p>
        ) : null}
      </header>
      {page.sections.map((section) => (
        <section key={section.heading} className="content-page__section">
          <h2>{section.heading}</h2>
          <Paragraphs text={section.body} />
        </section>
      ))}
      {page.faqs.length > 0 ? (
        <div className="content-page__faqs">
          {page.faqs.map((faq) => (
            <details key={faq.question}>
              <summary>{faq.question}</summary>
              <Paragraphs text={faq.answer} />
            </details>
          ))}
        </div>
      ) : null}
    </main>
  );
}
