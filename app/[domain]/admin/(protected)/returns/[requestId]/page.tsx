import { guardAdminPage } from "@/lib/admin/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import AdminReturnDetailClient from "@/components/admin/admin-return-detail-client";

export default async function AdminReturnDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  await guardAdminPage(PERMISSIONS.RETURNS_MANAGE);
  const { requestId } = await params;
  return <AdminReturnDetailClient requestId={requestId} />;
}
