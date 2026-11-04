import { AdminBannerEdit } from "@/components/admin/admin-banners-client";
import { guardAdminPage } from "@/lib/admin/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

export const metadata = { title: "Edit banner | Admin" };

export default async function EditAdminBannerPage({ params }: { params: Promise<{ bannerId: string }> }) {
  await guardAdminPage(PERMISSIONS.MARKETING_MANAGE);
  const { bannerId } = await params;
  return <AdminBannerEdit bannerId={bannerId} />;
}
