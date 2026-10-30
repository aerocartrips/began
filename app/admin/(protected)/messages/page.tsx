import { connectDB } from "@/lib/db/connect";
import AdminSupportInboxClient from "@/components/admin/admin-support-inbox-client";
import IntegrationState from "@/components/admin/integration-state";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import { listSupportConversations } from "@/lib/services/support-messages.service";

async function loadConversations() {
  await connectDB();
  return listSupportConversations({});
}

export default async function AdminMessagesPage() {
  let conversations;
  try {
    conversations = await loadConversations();
  } catch {
    return (
      <>
        <AdminPageHeading eyebrow="Support" title="Messages" description="Customer support inbox." />
        <IntegrationState
          title="Support inbox unavailable"
          description="MongoDB is required for the support inbox."
          requirement="Configure MONGODB_URI and retry."
        />
      </>
    );
  }

  return <AdminSupportInboxClient conversations={conversations} />;
}
