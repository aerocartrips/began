import AdminReturnDetailClient from "@/components/admin/admin-return-detail-client";

export default async function AdminReturnDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  return <AdminReturnDetailClient requestId={requestId} />;
}
