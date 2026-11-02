import Link from "next/link";
import { getStorePage } from "@/lib/content/pages";

/** The first few answers from the store's FAQ page. */
export default async function ContactFaq({ tenantId }: { tenantId: string }) {
  const faq = await getStorePage(tenantId, "faq");
  const questions = faq?.faqs.slice(0, 4) ?? [];
  if (questions.length === 0) return null;

  return (
    <section className="contact-faq" aria-labelledby="contact-faq-title">
      <div className="contact-section-heading">
        <p className="contact-eyebrow">A few quick answers</p>
        <h2 id="contact-faq-title">Before you reach out</h2>
      </div>
      <div className="contact-faq-list">
        {questions.map(({ question, answer }) => (
          <details key={question}>
            <summary>{question}</summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
      <Link className="text-link" href="/faq">All questions</Link>
    </section>
  );
}
