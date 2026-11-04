import { AdminGuideForm } from "@/components/admin/admin-guides-client";
import { guardAdminPage } from "@/lib/admin/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

export const metadata = { title: "New guide | Admin" };

export default async function NewAdminGuidePage() {
  await guardAdminPage(PERMISSIONS.MARKETING_MANAGE);
  return <AdminGuideForm />;
}
