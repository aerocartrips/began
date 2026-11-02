import { PERMISSIONS } from "@/lib/auth/permissions";
import { notFound, unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requireAdmin } from "@/lib/admin/auth";
import { withCurrentTenant } from "@/lib/tenant/current";
import AdminSupportDetailClient from "@/components/admin/admin-support-detail-client";
import { getSupportConversationDetail } from "@/lib/services/support-messages.service";

async function loadConversation(messageId: string) {
  await connection();
  await connectDB();
  return withCurrentTenant(async () => {
    await requireAdmin(PERMISSIONS.SUPPORT_MANAGE);
    return getSupportConversationDetail(messageId);
  });
}

export default async function AdminMessageDetailPage({
  params,
}: {
  params: Promise<{ messageId: string }>;
}) {
  const { messageId } = await params;
  let detail;
  try {
    detail = await loadConversation(messageId);
  } catch (error) {
    unstable_rethrow(error);
    notFound();
  }

  return (
    <AdminSupportDetailClient
      conversation={detail.conversation}
      initialMessages={detail.messages}
      initialHasMore={detail.hasMore}
    />
  );
}
