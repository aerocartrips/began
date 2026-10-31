import "server-only";

import { cache } from "react";
import { connection } from "next/server";
import { connectDB, isDatabaseConfigured } from "@/lib/db/connect";
import { Product } from "@/lib/db/models/Product";
import { PRODUCT_STATUS } from "@/lib/constants/product-status";
import { products as staticProducts } from "@/data/products";
import {
  mapMongoProductToStorefront,
  mapStaticProductToStorefront,
  stripInternalCatalogFields,
} from "@/lib/catalog/map-storefront-product";

async function loadDatabaseCatalog() {
  if (!isDatabaseConfigured()) return null;

  await connection();
  await connectDB();
  const docs = await Product.find({ status: PRODUCT_STATUS.ACTIVE })
    .sort({ featured: -1, createdAt: -1 })
    .populate("category", "name slug")
    .lean();

  if (!docs.length) return null;
  return docs.map((doc) => mapMongoProductToStorefront(doc));
}

/** Static catalog only — safe for layout Suspense fallbacks (no DB). */
export function getStaticStorefrontCatalogProducts() {
  return staticProducts.map((product) => {
    const mapped = mapStaticProductToStorefront(product);
    const { _source, ...rest } = mapped;
    return rest;
  });
}

export const getStorefrontCatalog = cache(async () => {
  try {
    const databaseProducts = await loadDatabaseCatalog();
    if (databaseProducts?.length) {
      return {
        source: "database",
        products: stripInternalCatalogFields(databaseProducts),
      };
    }
  } catch {
    // Fall back to static catalog when MongoDB is unavailable.
  }

  return {
    source: "static",
    products: getStaticStorefrontCatalogProducts(),
  };
});

export async function getStorefrontProductBySlug(slug) {
  const catalog = await getStorefrontCatalog();
  return catalog.products.find((product) => product.slug === slug) ?? null;
}

export async function getStorefrontProductSlugs() {
  const catalog = await getStorefrontCatalog();
  return catalog.products.map((product) => product.slug);
}
