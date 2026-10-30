export type NavigationItem = {
  label: string;
  href: string;
};

export const siteNavigation: readonly NavigationItem[] = [
  { label: "Catalog", href: "/products" },
  { label: "Contact", href: "/contact" },
  { label: "Global Export", href: "/#enterprise" },
  { label: "Smart Weaving", href: "/#network" },
  { label: "Bulk Deals", href: "/#batches" },
] as const;

export const footerColumns = {
  account: [
    { label: "My Orders", href: "/account/orders" },
    { label: "My Reviews", href: "/account/reviews" },
    { label: "Sign In", href: "/account/login" },
    { label: "Create Account", href: "/account/register" },
  ],
  support: [
    { label: "Contact Us", href: "/contact" },
    { label: "Shipping Information", href: "/shipping" },
    { label: "Returns & Refunds", href: "/returns" },
  ],
  marketplace: [
    { label: "Bulk Catalog", href: "/#batches" },
    { label: "Quantum Weaves", href: "/#collections" },
    { label: "Custom Manufacturing", href: "/#enterprise" },
    { label: "Supplier Onboarding", href: "/#enterprise" },
    { label: "Contact", href: "/contact" },
  ],
  enterprise: [
    { label: "API Documentation", href: "/#network" },
    { label: "Global Logistics", href: "/#network" },
    { label: "Smart Contracts", href: "/#network" },
    { label: "Sustainability Report", href: "/#network" },
  ],
  legal: [
    { label: "Terms of Settlement", href: "/#enterprise" },
    { label: "Data Privacy Protocol", href: "/#enterprise" },
    { label: "Compliance", href: "/#enterprise" },
  ],
} as const satisfies Record<
  "account" | "support" | "marketplace" | "enterprise" | "legal",
  readonly NavigationItem[]
>;

export const siteContact = {
  email: process.env.NEXT_PUBLIC_BUSINESS_EMAIL?.trim() || null,
  phone: process.env.NEXT_PUBLIC_BUSINESS_PHONE?.trim() || null,
  address: process.env.NEXT_PUBLIC_BUSINESS_ADDRESS?.trim() || null,
  hours: process.env.NEXT_PUBLIC_BUSINESS_HOURS?.trim() || null,
} as const;
