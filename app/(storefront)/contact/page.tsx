import type { Metadata } from "next";
import ContactCta from "@/components/contact/contact-cta";
import ContactFaq from "@/components/contact/contact-faq";
import ContactForm from "@/components/contact/contact-form";
import ContactHero from "@/components/contact/contact-hero";
import ContactInfoSection from "@/components/contact/contact-info-section";
import BusinessLocationMap from "@/components/contact/business-location-map";
import { siteContact } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Contact NeoVastra | Saree and Wholesale Support",
  description: "Contact NeoVastra about saree details, wholesale batches, and supplier inquiries.",
};

export default function ContactPage() {
  return (
    <main className="contact-page content-width">
      <ContactHero />
      <ContactInfoSection />
      <div className="contact-main-grid">
        <ContactForm />
        <BusinessLocationMap address={siteContact.address} />
      </div>
      <ContactFaq />
      <ContactCta />
    </main>
  );
}