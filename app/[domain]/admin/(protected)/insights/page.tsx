import { connection } from "next/server";
import CatalogInsightsClient, { type CatalogInsights } from "@/components/admin/catalog-insights-client";
import { requireAdmin } from "@/lib/admin/auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { connectDB } from "@/lib/db/connect";
import { getCatalogInsights } from "@/lib/services/catalog-insights.service";
import { withCurrentTenant } from "@/lib/tenant/current";
import { toPlain } from "@/lib/utils/plain";

export const metadata = { title: "Catalogue insights | Admin" };

export default async function AdminCatalogInsightsPage() {
  await connection();
  await connectDB();
  // The first view (last 30 days, every type) arrives with the page; filters refetch from the API.
  const initial: CatalogInsights = await withCurrentTenant(async () => {
    await requireAdmin(PERMISSIONS.CATALOG_MANAGE);
    return toPlain(await getCatalogInsights({ days: 30 }));
  });
  return <CatalogInsightsClient initial={initial} />;
}
