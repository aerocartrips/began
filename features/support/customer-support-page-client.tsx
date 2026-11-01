"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MessageSquare, Plus } from "lucide-react";
import Button from "@/components/ui/button";
import ErrorCard from "@/components/ui/feedback/error-card";
import { ConversationListSkeleton } from "@/components/support/chat/thread-skeleton";
import { useFeedback } from "@/components/feedback/feedback-provider";
import ConversationList from "@/features/support/components/conversation-list";
import CustomerThread from "@/features/support/components/customer-thread";
import NewConversationForm from "@/features/support/components/new-conversation-form";
import { fetchCustomerConversation } from "@/features/support/support-api";
import type { CustomerConversation } from "@/features/support/types";
import { useCustomerConversations } from "@/features/support/use-customer-conversations";

export default function CustomerSupportPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const feedback = useFeedback();
  const selectedId = searchParams.get("c");
  const composing = searchParams.get("new") === "1";

  const redirectToLogin = useCallback(() => {
    router.replace(`/account/login?next=${encodeURIComponent("/account/support")}`);
  }, [router]);

  const conversations = useCustomerConversations({ onAuthError: redirectToLogin });
  const { upsert, markRead } = conversations;
  const selected = conversations.items.find((item) => item.id === selectedId) ?? null;

  // Deep link to a conversation that is not on the first loaded page.
  const [missingId, setMissingId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedId || selected || conversations.status !== "ready" || missingId === selectedId) return;
    const controller = new AbortController();
    fetchCustomerConversation(selectedId, controller.signal)
      .then(upsert)
      .catch(() => {
        if (controller.signal.aborted) return;
        setMissingId(selectedId);
        feedback.warning("Conversation not found", "It may have been removed or belongs to another account.");
      });
    return () => controller.abort();
  }, [conversations.status, feedback, missingId, selected, selectedId, upsert]);

  const navigate = useCallback(
    (params: Record<string, string> | null, mode: "push" | "replace" = "push") => {
      const query = params ? `?${new URLSearchParams(params).toString()}` : "";
      router[mode](`${pathname}${query}`, { scroll: false });
    },
    [pathname, router],
  );

  const selectConversation = useCallback((id: string) => navigate({ c: id }), [navigate]);
  const showList = useCallback(() => navigate(null, "replace"), [navigate]);

  function handleCreated(conversation: CustomerConversation) {
    upsert(conversation);
    feedback.success("Message sent", "We will reply here and you will see it in this conversation.");
    navigate({ c: conversation.id }, "replace");
  }

  const paneOpen = composing || Boolean(selectedId);
  const empty = conversations.status === "ready" && conversations.items.length === 0;

  return (
    <main className="commerce-page content-width account-page support-page">
      <div className="commerce-heading">
        <div>
          <p className="eyebrow">Wholesale account</p>
          <h1>Support</h1>
          <p className="account-lead">Message our team about orders, payments, deliveries or products.</p>
        </div>
        {!empty ? (
          <Button type="button" size="sm" icon={<Plus size={14} aria-hidden="true" />} onClick={() => navigate({ new: "1" })}>
            New conversation
          </Button>
        ) : null}
      </div>

      {conversations.status === "error" ? (
        <ErrorCard
          title="Support inbox unavailable"
          description="We could not load your conversations. Check your connection and try again."
          action={<Button type="button" size="sm" onClick={conversations.reload}>Try again</Button>}
        />
      ) : empty && !composing ? (
        <section className="support-empty">
          <span className="support-empty__icon" aria-hidden="true"><MessageSquare size={22} /></span>
          <h2>No conversations yet</h2>
          <p>Questions about an order, a payment or a product? Start a conversation and our team will reply right here.</p>
          <Button type="button" size="sm" onClick={() => navigate({ new: "1" })}>Start a conversation</Button>
        </section>
      ) : (
        <div className={["support-layout", paneOpen && "is-pane-open"].filter(Boolean).join(" ")}>
          <aside className="support-sidebar" aria-label="Conversations">
            {conversations.status === "loading" ? (
              <ConversationListSkeleton />
            ) : (
              <>
                <ConversationList items={conversations.items} selectedId={composing ? null : selectedId} onSelect={selectConversation} />
                {conversations.hasMore ? (
                  <button
                    type="button"
                    className="support-sidebar__more"
                    disabled={conversations.loadingMore}
                    onClick={() =>
                      void conversations.loadMore().catch(() => feedback.error("Could not load more", "Please try again."))
                    }
                  >
                    {conversations.loadingMore ? "Loading…" : "Load more conversations"}
                  </button>
                ) : null}
              </>
            )}
          </aside>

          <div className="support-main">
            {composing ? (
              <NewConversationForm
                onCreated={handleCreated}
                onCancel={empty ? undefined : showList}
                onAuthError={redirectToLogin}
              />
            ) : selected ? (
              <CustomerThread
                key={selected.id}
                conversation={selected}
                onBack={showList}
                onConversation={upsert}
                onMarkedRead={markRead}
                onAuthError={redirectToLogin}
              />
            ) : (
              <div className="support-main__placeholder">
                <MessageSquare size={20} aria-hidden="true" />
                <p>{selectedId && missingId !== selectedId ? "Opening conversation…" : "Select a conversation to read and reply."}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
