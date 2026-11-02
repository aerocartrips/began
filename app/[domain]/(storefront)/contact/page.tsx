import type { Metadata } from "next";
import ContactCta from "@/components/contact/contact-cta";
import ContactFaq from "@/components/contact/contact-faq";
import ContactForm from "@/components/contact/contact-form";
import ContactHero from "@/components/contact/contact-hero";
import ContactInfoSection from "@/components/contact/contact-info-section";
import BusinessLocationMap from "@/components/contact/business-location-map";
import { getCurrentTenant } from "@/lib/tenant/current";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Contact us about saree details, wholesale batches, and supplier inquiries.",
};

export default async function ContactPage() {
  const { id, contact } = await getCurrentTenant();
  return (
    <main className="contact-page content-width">
      <ContactHero />
      <ContactInfoSection contact={contact} />
      <div className="contact-main-grid">
        <ContactForm />
        {contact.address ? <BusinessLocationMap address={contact.address} /> : null}
      </div>
      <ContactFaq tenantId={id} />
      <ContactCta />
    </main>
  );
}