import type { CSSProperties, ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Cinzel_Decorative, Montserrat } from "next/font/google";
import { TenantProvider } from "@/features/tenant/tenant-provider";
import { getCurrentTenant } from "@/lib/tenant/current";
import { listBuildTimeDomains } from "@/lib/tenant/build";
import { rootMetadata } from "@/lib/seo/metadata";
import { themeToCssVariables } from "@/lib/tenant/theme";
import "../globals.css";
import "../catalog.css";
import "../landing.css";
import "../form-controls.css";
import "../commerce.css";
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

/** Store-wide head defaults (lib/seo/metadata.ts); every page adds its own title, canonical and share data. */
export async function generateMetadata(): Promise<Metadata> {
  return rootMetadata(await getCurrentTenant());
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
        {/* Product photos load straight from Cloudinary (components/images/product-image.tsx): open the
            connection while the page is still loading. React moves this into <head>. */}
        {process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ? <link rel="preconnect" href="https://res.cloudinary.com" /> : null}
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
