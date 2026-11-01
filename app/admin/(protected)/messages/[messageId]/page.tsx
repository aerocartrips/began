import { notFound } from "next/navigation";
import { connection } from "next/server";
import { connectDB } from "@/lib/db/connect";
import AdminSupportDetailClient from "@/components/admin/admin-support-detail-client";
import { getSupportConversationDetail } from "@/lib/services/support-messages.service";

async function loadConversation(messageId: string) {
  await connection();
  await connectDB();
  return getSupportConversationDetail(messageId);
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
  } catch {
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
