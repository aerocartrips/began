import "server-only";

import { cache } from "react";
import { connection } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";
import { connectDB, isDatabaseConfigured } from "@/lib/db/connect";
import { Product } from "@/lib/db/models/Product";
import { PRODUCT_STATUS } from "@/lib/constants/product-status";
import { products as staticProducts } from "@/data/products";
import { CATALOG_CACHE_TAG } from "@/lib/catalog/catalog-cache";
import { logger } from "@/lib/utils/logger";
import {
  mapMongoProductToStorefront,
  mapStaticProductToStorefront,
  stripInternalCatalogFields,
} from "@/lib/catalog/map-storefront-product";

/**
 * Active products from MongoDB, shared across requests for a few minutes and
 * invalidated by Product writes (see the hooks in lib/db/models/Product.js).
 */
async function queryDatabaseCatalog() {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_CACHE_TAG);

  await connectDB();
  const docs = await Product.find({ status: PRODUCT_STATUS.ACTIVE })
    .sort({ featured: -1, createdAt: -1 })
    .populate("category", "name slug")
    .lean();

  if (!docs.length) return null;
  return docs.map((doc) => mapMongoProductToStorefront(doc));
}

async function loadDatabaseCatalog() {
  if (!isDatabaseConfigured()) return null;

  // Keep the catalog request-time so builds never bake in the static fallback.
  await connection();
  return queryDatabaseCatalog();
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
  } catch (error) {
    unstable_rethrow(error);
    // Fall back to the static catalog when MongoDB is unavailable.
    logger.error("Storefront catalog query failed; serving static catalog", { error });
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

/** Build-time slugs for generateStaticParams (no request, so no `connection()`). */
export async function getStorefrontProductSlugs() {
  if (isDatabaseConfigured()) {
    try {
      const databaseProducts = await queryDatabaseCatalog();
      if (databaseProducts?.length) return databaseProducts.map((product) => product.slug);
    } catch (error) {
      logger.warn("Could not read product slugs from MongoDB at build time", { error });
    }
  }
  return getStaticStorefrontCatalogProducts().map((product) => product.slug);
}
