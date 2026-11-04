import AdminHomepageClient from "@/components/admin/admin-homepage-client";
import { guardAdminPage } from "@/lib/admin/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

export const metadata = { title: "Home page | Admin" };

export default async function AdminHomepagePage() {
  await guardAdminPage(PERMISSIONS.MARKETING_MANAGE);
  return <AdminHomepageClient />;
}
