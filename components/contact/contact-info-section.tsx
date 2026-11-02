import { Clock3, Mail, MapPin, Phone } from "lucide-react";
import ContactInfoCard from "@/components/contact/contact-info-card";
import type { PublicTenant } from "@/lib/tenant/types";

/** Store contact details; cards for details the store has not set are omitted. */
export default function ContactInfoSection({ contact }: { contact: PublicTenant["contact"] }) {
  const cards = [
    contact.email && {
      icon: Mail,
      title: "Email",
      value: contact.email,
      href: `mailto:${contact.email}`,
      description: "For orders, products and wholesale questions.",
    },
    contact.phone && {
      icon: Phone,
      title: "Phone",
      value: contact.phone,
      href: `tel:${contact.phone.replace(/[^+\d]/g, "")}`,
      description: "Call our support team.",
    },
    contact.address && {
      icon: MapPin,
      title: "Address",
      value: contact.address,
      href: `https://maps.google.com/?q=${encodeURIComponent(contact.address)}`,
      description: "Open directions to our business location.",
    },
    contact.hours && {
      icon: Clock3,
      title: "Business hours",
      value: contact.hours,
      href: null,
      description: "When our team is available.",
    },
  ].filter((card) => Boolean(card)) as {
    icon: typeof Mail;
    title: string;
    value: string;
    href: string | null;
    description: string;
  }[];

  if (cards.length === 0) return null;

  return (
    <section className="contact-info-grid" aria-label="Business contact details">
      {cards.map((card) => (
        <ContactInfoCard key={card.title} {...card} />
      ))}
    </section>
  );
}
