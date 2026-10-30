import type { Product } from "@/features/products/types/product";

let activeCatalog: Product[] = [];

export function setActiveCatalog(products: readonly Product[]) {
  activeCatalog = products.map((product) => ({
    ...product,
    images: product.images.map((image) => ({ ...image })),
    options: product.options.map((option) => ({
      ...option,
      values: option.values.map((value) => ({ ...value })),
    })),
    saree: { ...product.saree },
  }));
}

export function getCatalogProductById(id: string) {
  return activeCatalog.find((product) => product.id === id);
}

export function getCatalogProductBySlug(slug: string) {
  return activeCatalog.find((product) => product.slug === slug);
}

export function getActiveCatalogProducts() {
  return activeCatalog;
}
