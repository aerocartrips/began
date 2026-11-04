import { AdminBannerForm } from "@/components/admin/admin-banners-client";
import { guardAdminPage } from "@/lib/admin/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

export const metadata = { title: "New banner | Admin" };

export default async function NewAdminBannerPage() {
  await guardAdminPage(PERMISSIONS.MARKETING_MANAGE);
  return <AdminBannerForm />;
}
