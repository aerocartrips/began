import { connection } from "next/server";
import { connectDB } from "@/lib/db/connect";
import AdminSupportInboxClient from "@/components/admin/admin-support-inbox-client";
import IntegrationState from "@/components/admin/integration-state";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import { listSupportConversations } from "@/lib/services/support-messages.service";

type InboxSearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function loadConversations(filters: Record<string, string>) {
  await connection();
  await connectDB();
  return listSupportConversations({
    status: filters.status || undefined,
    category: filters.category || undefined,
    view: filters.view || undefined,
    search: filters.search || undefined,
    page: Number(filters.page) || 1,
    limit: 30,
  });
}

export default async function AdminMessagesPage({ searchParams }: { searchParams: InboxSearchParams }) {
  const raw = await searchParams;
  const filters = {
    status: single(raw.status) ?? "",
    category: single(raw.category) ?? "",
    view: single(raw.view) ?? "",
    search: (single(raw.search) ?? "").slice(0, 100),
    page: single(raw.page) ?? "1",
  };

  let result;
  try {
    result = await loadConversations(filters);
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

  return (
    <AdminSupportInboxClient
      conversations={result.items}
      meta={result.meta}
      counts={result.counts}
      filters={filters}
    />
  );
}
