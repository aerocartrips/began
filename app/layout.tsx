import type { ReactNode } from "react";
import { Suspense } from "react";
import { Cinzel_Decorative, Montserrat } from "next/font/google";
import { getStaticStorefrontCatalogProducts } from "@/lib/catalog/storefront-catalog";
import { ProductCatalogProvider } from "@/features/products/product-catalog-provider";
import type { Product } from "@/features/products/types/product";
import { StorefrontCatalogBoundary } from "@/app/storefront-catalog-boundary";
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

const staticCatalogProducts = getStaticStorefrontCatalogProducts() as Product[];

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${cinzel.variable} ${montserrat.variable}`}
      data-scroll-behavior="smooth"
    >
      <body>
        <Suspense
          fallback={
            <ProductCatalogProvider initialProducts={staticCatalogProducts}>
              {children}
            </ProductCatalogProvider>
          }
        >
          <StorefrontCatalogBoundary>{children}</StorefrontCatalogBoundary>
        </Suspense>
      </body>
    </html>
  );
}
