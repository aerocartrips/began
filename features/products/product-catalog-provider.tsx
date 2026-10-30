"use client";

import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react";
import { setActiveCatalog } from "@/features/products/catalog-lookup";
import type { Product } from "@/features/products/types/product";

export type CatalogMutationResult =
  | { ok: true }
  | { ok: false; message: string };

type ProductCatalogContextValue = {
  products: Product[];
  createProduct: (product: Product) => CatalogMutationResult;
  updateProduct: (productId: string, product: Product) => CatalogMutationResult;
  deleteProduct: (productId: string) => void;
};

const ProductCatalogContext = createContext<ProductCatalogContextValue | null>(null);

function findConflict(products: Product[], product: Product, exceptId?: string) {
  return products.find((candidate) =>
    candidate.id !== exceptId &&
    (candidate.slug.toLowerCase() === product.slug.toLowerCase() ||
      candidate.sku.toLowerCase() === product.sku.toLowerCase()),
  );
}

export function ProductCatalogProvider({
  initialProducts,
  children,
}: {
  initialProducts: readonly Product[];
  children: ReactNode;
}) {
  const [products, setProducts] = useState<Product[]>(() => initialProducts.map((product) => ({
    ...product,
    images: product.images.map((image) => ({ ...image })),
    options: product.options.map((option) => ({
      ...option,
      values: option.values.map((value) => ({ ...value })),
    })),
    saree: { ...product.saree },
  })));

  useLayoutEffect(() => {
    setActiveCatalog(products);
  }, [products]);

  function createProduct(product: Product): CatalogMutationResult {
    if (findConflict(products, product)) {
      return { ok: false, message: "A product with this slug or SKU already exists." };
    }
    setProducts((current) => [...current, product]);
    return { ok: true };
  }

  function updateProduct(productId: string, product: Product): CatalogMutationResult {
    if (!products.some((candidate) => candidate.id === productId)) {
      return { ok: false, message: "This product is no longer available." };
    }
    if (findConflict(products, product, productId)) {
      return { ok: false, message: "A product with this slug or SKU already exists." };
    }
    setProducts((current) => current.map((candidate) =>
      candidate.id === productId ? product : candidate,
    ));
    return { ok: true };
  }

  function deleteProduct(productId: string) {
    setProducts((current) => current.filter((product) => product.id !== productId));
  }

  return (
    <ProductCatalogContext.Provider value={{ products, createProduct, updateProduct, deleteProduct }}>
      {children}
    </ProductCatalogContext.Provider>
  );
}

export function useProductCatalog() {
  const context = useContext(ProductCatalogContext);
  if (!context) throw new Error("useProductCatalog must be used within ProductCatalogProvider.");
  return context;
}