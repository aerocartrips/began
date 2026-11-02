import { AdminQuoteDetail } from "@/components/admin/admin-quotes-client";
import { guardAdminPage } from "@/lib/admin/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

export const metadata = { title: "Quote | Admin" };

export default async function AdminQuotePage({ params }: { params: Promise<{ quoteId: string }> }) {
  await guardAdminPage(PERMISSIONS.QUOTES_MANAGE);
  const { quoteId } = await params;
  return <AdminQuoteDetail quoteId={quoteId} />;
}
