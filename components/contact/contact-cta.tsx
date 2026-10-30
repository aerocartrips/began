import Link from "next/link";

export default function ContactCta() {
  return (
    <aside className="contact-cta">
      <div><p className="contact-eyebrow">Still have a question?</p><h2>We&apos;re listening.</h2></div>
      <Link href="#contact-form">Write to our team<span aria-hidden="true">↓</span></Link>
    </aside>
  );
}