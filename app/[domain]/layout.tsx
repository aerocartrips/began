import type { CSSProperties, ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Cinzel_Decorative, Montserrat } from "next/font/google";
import { TenantProvider } from "@/features/tenant/tenant-provider";
import { getCurrentTenant } from "@/lib/tenant/current";
import { listBuildTimeDomains } from "@/lib/tenant/build";
import { themeToCssVariables } from "@/lib/tenant/theme";
import "../globals.css";
import "../catalog.css";
import "../landing.css";
import "../form-controls.css";
import "../mobile.css";

/** Edge to edge on notched phones (app/mobile.css pads the safe areas); the browser bar matches the header. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

const cinzel = Cinzel_Decorative({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

/** Prerender the shell for every active store; other hosts render on demand. */
export async function generateStaticParams() {
  return (await listBuildTimeDomains()).map((domain) => ({ domain }));
}

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getCurrentTenant();
  const { siteTitle, description, faviconUrl } = tenant.branding;
  return {
    metadataBase: new URL(`https://${tenant.primaryDomain}`),
    title: { default: siteTitle, template: `%s | ${siteTitle}` },
    description: description || undefined,
    icons: faviconUrl ? { icon: faviconUrl } : undefined,
    openGraph: { siteName: siteTitle, locale: "en_IN", type: "website" },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const tenant = await getCurrentTenant();

  return (
    <html
      lang="en-IN"
      className={`${cinzel.variable} ${montserrat.variable}`}
      style={themeToCssVariables(tenant.branding.theme) as CSSProperties}
      data-scroll-behavior="smooth"
    >
      <body>
        <TenantProvider
          tenant={{
            name: tenant.name,
            siteTitle: tenant.branding.siteTitle,
            logoUrl: tenant.branding.logoUrl,
            salesMode: tenant.salesMode,
            paymentsEnabled: Boolean(tenant.razorpayKeyId),
            contact: tenant.contact,
          }}
        >
          {children}
        </TenantProvider>
      </body>
    </html>
  );
}
