export type SalesMode = "wholesale" | "retail";

export type TenantTheme = {
  brand: string;
  brandSecondary: string;
  accent: string;
  text: string;
  textMuted: string;
  background: string;
  surface: string;
  border: string;
};

/** Store configuration that is safe to render and send to the browser. */
export type PublicTenant = {
  id: string;
  slug: string;
  name: string;
  primaryDomain: string;
  salesMode: SalesMode;
  branding: {
    siteTitle: string;
    tagline: string;
    description: string;
    logoUrl: string;
    heroImageUrl: string;
    faviconUrl: string;
    theme: TenantTheme;
  };
  contact: {
    email: string;
    phone: string;
    address: string;
    hours: string;
    social: { instagram?: string; linkedin?: string; x?: string };
  };
  business: {
    legalName: string;
    gstin: string;
    registeredAddress: string;
    invoicePrefix: string;
  };
  notificationEmail: string;
  razorpayKeyId: string;
  /** Search engine ownership tokens, rendered as verification <meta> tags. */
  seo: {
    googleSiteVerification: string;
    bingSiteVerification: string;
  };
};
