import AdminHomepageClient from "@/components/admin/admin-homepage-client";
import { guardAdminPage } from "@/lib/admin/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getCatalogConfig } from "@/lib/catalog/catalog-config";
import { getCurrentTenant } from "@/lib/tenant/current";

export const metadata = { title: "Home page | Admin" };

export default async function AdminHomepagePage() {
  await guardAdminPage(PERMISSIONS.MARKETING_MANAGE);
  // What the store sells (cached storefront data), for type and product-detail collections.
  const config = await getCatalogConfig((await getCurrentTenant()).id);
  const catalog = {
    types: config.types.map((type) => ({ slug: type.slug, name: type.pluralName })),
    attributes: Object.values(config.attributes)
      .filter((attribute) => attribute.values.length > 0)
      .map((attribute) => ({ key: attribute.key, name: attribute.name, values: attribute.values })),
  };
  return <AdminHomepageClient catalog={catalog} />;
}
