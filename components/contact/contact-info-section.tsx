import { Clock3, Mail, MapPin, Phone } from "lucide-react";
import ContactInfoCard from "@/components/contact/contact-info-card";
import { siteContact } from "@/lib/site-content";

export default function ContactInfoSection() {
  return (
    <section className="contact-info-grid" aria-label="Business contact details">
      <ContactInfoCard
        icon={Mail}
        title="Email"
        value={siteContact.email}
        href={siteContact.email ? `mailto:${siteContact.email}` : null}
        description={siteContact.email ? "For wholesale and product questions." : "Set NEXT_PUBLIC_BUSINESS_EMAIL to publish a support address."}
      />
      <ContactInfoCard
        icon={Phone}
        title="Phone"
        value={siteContact.phone}
        href={siteContact.phone ? `tel:${siteContact.phone.replace(/[^+\d]/g, "")}` : null}
        description={siteContact.phone ? "Call our business support team." : "Set NEXT_PUBLIC_BUSINESS_PHONE to publish a support number."}
      />
      <ContactInfoCard
        icon={MapPin}
        title="Studio"
        value={siteContact.address}
        href={siteContact.address ? `https://maps.google.com/?q=${encodeURIComponent(siteContact.address)}` : null}
        description={siteContact.address ? "Open directions to our business location." : "Set NEXT_PUBLIC_BUSINESS_ADDRESS to publish a location."}
      />
      <ContactInfoCard
        icon={Clock3}
        title="Business hours"
        value={siteContact.hours}
        description={siteContact.hours ? "Local business hours." : "Set NEXT_PUBLIC_BUSINESS_HOURS to publish availability."}
      />
    </section>
  );
}