import AdminNewsletterClient from "@/components/admin/admin-newsletter-client";
import { guardAdminPage } from "@/lib/admin/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

export const metadata = { title: "Newsletter | Admin" };

export default async function AdminNewsletterPage() {
  await guardAdminPage(PERMISSIONS.MARKETING_MANAGE);
  return <AdminNewsletterClient />;
}
