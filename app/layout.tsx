import type { ReactNode } from "react";
import { Cinzel_Decorative, Montserrat } from "next/font/google";
import { getStorefrontCatalog } from "@/lib/catalog/storefront-catalog";
import { ProductCatalogProvider } from "@/features/products/product-catalog-provider";
import "./globals.css";

const cinzel = Cinzel_Decorative({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

export const metadata = {
  title: "NeoVastra | Global Saree Marketplace",
  description:
    "Discover heritage sarees and connect directly with verified weavers through NeoVastra's global B2B marketplace.",
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const catalog = await getStorefrontCatalog();

  return (
    <html
      lang="en"
      className={`${cinzel.variable} ${montserrat.variable}`}
      data-scroll-behavior="smooth"
    >
      <body>
        <ProductCatalogProvider initialProducts={catalog.products}>
          {children}
        </ProductCatalogProvider>
      </body>
    </html>
  );
}
