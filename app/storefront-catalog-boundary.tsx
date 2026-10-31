import type { ReactNode } from "react";
import { getStorefrontCatalog } from "@/lib/catalog/storefront-catalog";
import { ProductCatalogProvider } from "@/features/products/product-catalog-provider";

export async function StorefrontCatalogBoundary({ children }: { children: ReactNode }) {
  const catalog = await getStorefrontCatalog();

  return (
    <ProductCatalogProvider initialProducts={catalog.products}>{children}</ProductCatalogProvider>
  );
}
