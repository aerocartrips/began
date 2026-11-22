import "server-only";

import { connection } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requireAdmin } from "@/lib/admin/auth";
import { PERMISSIONS, roleHasPermission } from "@/lib/auth/permissions";
import { withCurrentTenant } from "@/lib/tenant/current";
import { listProductTypes } from "@/lib/services/product-type.service";
import { listAttributes } from "@/lib/services/attribute.service";
import { listCategories } from "@/lib/services/category.service";
import { getProduct } from "@/lib/services/product.service";
import { toPlain } from "@/lib/utils/plain";
import { ApiError } from "@/lib/utils/api-error";
import type { AdminAttribute, ProductTypesPayload } from "@/features/products/catalog-setup";
import type { AdminProductRecord } from "@/features/products/admin-product";

export type AdminCatalogData = ProductTypesPayload & {
  attributes: AdminAttribute[];
  categories: { _id: string; name: string; slug: string; isActive: boolean }[];
  /** The signed-in admin may change store settings (owners): selling setup and the catalogue upgrade. */
  canManageStore: boolean;
};

/**
 * Everything the catalogue admin screens need in one server round trip: the
 * product types (with templates), the attribute library and the categories.
 * Signs the admin in (or refuses them) first.
 */
export async function loadAdminCatalog(): Promise<AdminCatalogData> {
  await connection();
  await connectDB();
  return withCurrentTenant(async () => {
    const session = await requireAdmin(PERMISSIONS.CATALOG_MANAGE);
    const [types, attributes, categories] = await Promise.all([listProductTypes(), listAttributes(), listCategories({ includeInactive: true })]);
    return { ...toPlain({ ...types, attributes, categories }), canManageStore: roleHasPermission(session.adminRole, PERMISSIONS.SETTINGS_MANAGE) };
  });
}

/** Product types and templates for Store settings → What you sell (store owners). */
export async function loadSellingSetup(): Promise<ProductTypesPayload> {
  await connection();
  await connectDB();
  return withCurrentTenant(async () => {
    await requireAdmin(PERMISSIONS.SETTINGS_MANAGE);
    return toPlain(await listProductTypes());
  });
}

/** The catalogue data plus one product, for the product editor; null when the product doesn't exist. */
export async function loadAdminProduct(productId: string): Promise<(AdminCatalogData & { product: AdminProductRecord }) | null> {
  const catalog = await loadAdminCatalog();
  const product = await withCurrentTenant(async () => {
    try {
      return toPlain(await getProduct(productId));
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) return null;
      throw error;
    }
  });
  return product ? { ...catalog, product } : null;
}
