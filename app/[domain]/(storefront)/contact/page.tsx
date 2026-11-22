import type { Metadata } from "next";
import ContactCta from "@/components/contact/contact-cta";
import ContactFaq from "@/components/contact/contact-faq";
import ContactForm from "@/components/contact/contact-form";
import ContactHero from "@/components/contact/contact-hero";
import ContactInfoSection from "@/components/contact/contact-info-section";
import BusinessLocationMap from "@/components/contact/business-location-map";
import { pageMetadata, siteNameOf } from "@/lib/seo/metadata";
import { getCurrentTenant } from "@/lib/tenant/current";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getCurrentTenant();
  const { phone, email } = tenant.contact;
  const ways = [phone ? `call ${phone}` : "", email ? `email ${email}` : ""].filter(Boolean);
  const topics = tenant.salesMode === "wholesale" ? "product details, wholesale orders and quotes" : "products, orders and delivery";
  return pageMetadata(tenant, {
    title: "Contact us",
    description: `Contact ${siteNameOf(tenant)} about ${topics}${ways.length ? `: ${ways.join(" or ")}` : ""}.`,
    path: "/contact",
  });
}

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