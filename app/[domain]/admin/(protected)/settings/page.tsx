import AdminSettingsClient from "@/components/admin/admin-settings-client";
import { loadSellingSetup } from "@/lib/admin/catalog-data";

export default async function AdminSettingsPage() {
  // Signs the owner in (Store settings needs settings permission) and loads what the store sells.
  const selling = await loadSellingSetup();
  return <AdminSettingsClient selling={selling} />;
}
