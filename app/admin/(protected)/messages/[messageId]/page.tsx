import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db/connect";
import AdminSupportDetailClient from "@/components/admin/admin-support-detail-client";
import { getSupportConversationDetail } from "@/lib/services/support-messages.service";

async function loadConversation(messageId: string) {
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

  const { conversation, messages } = detail;
  const customerLabel = conversation.guestEmail
    ? `${conversation.guestName || "Guest"} · ${conversation.guestEmail}`
    : conversation.guestName || "Customer";

  return (
    <AdminSupportDetailClient
      conversationId={String(conversation._id)}
      subject={conversation.subject}
      customerLabel={customerLabel}
      status={conversation.status}
      messages={messages.map((row) => ({
        _id: String(row._id),
        body: row.body,
        senderRole: row.senderRole,
        createdAt: row.createdAt?.toISOString?.() ?? new Date().toISOString(),
      }))}
    />
  );
}
