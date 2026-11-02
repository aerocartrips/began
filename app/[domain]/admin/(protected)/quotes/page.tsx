import { AdminQuoteList } from "@/components/admin/admin-quotes-client";
import { guardAdminPage } from "@/lib/admin/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

export const metadata = { title: "Quotes | Admin" };

export default async function AdminQuotesPage() {
  await guardAdminPage(PERMISSIONS.QUOTES_MANAGE);
  return <AdminQuoteList />;
}
