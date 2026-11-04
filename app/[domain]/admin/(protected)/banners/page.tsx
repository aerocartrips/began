import { AdminBannerList } from "@/components/admin/admin-banners-client";
import { guardAdminPage } from "@/lib/admin/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

export const metadata = { title: "Banners | Admin" };

export default async function AdminBannersPage() {
  await guardAdminPage(PERMISSIONS.MARKETING_MANAGE);
  return <AdminBannerList />;
}
