import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStorePage } from "@/lib/content/pages";
import { getCurrentTenant } from "@/lib/tenant/current";

/** Plain-text paragraphs; content is stored as text, never HTML. */
function Paragraphs({ text }: { text: string }) {
  return text.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>);
}

export async function storePageMetadata(slug: string): Promise<Metadata> {
  const tenant = await getCurrentTenant();
  const page = await getStorePage(tenant.id, slug);
  if (!page) return {};
  return { title: page.title, description: page.summary || undefined, alternates: { canonical: `/${slug}` } };
}

export default async function StoreContentPage({ slug }: { slug: string }) {
  const tenant = await getCurrentTenant();
  const page = await getStorePage(tenant.id, slug);
  if (!page) notFound();

  const faqData = page.faqs.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: page.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      }
    : null;

  return (
    <main className="content-page content-width">
      {faqData ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqData).replace(/</g, "\u003c") }} />
      ) : null}
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
