import AdminAnalyticsClient from "@/components/admin/admin-analytics-client";
import { guardAdminPage } from "@/lib/admin/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

export const metadata = { title: "Home page insights | Admin" };

export default async function AdminAnalyticsPage() {
  await guardAdminPage(PERMISSIONS.MARKETING_MANAGE);
  return <AdminAnalyticsClient />;
}
