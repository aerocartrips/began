import { Suspense } from "react";
import { ConversationListSkeleton } from "@/components/support/chat/thread-skeleton";
import CustomerSupportPageClient from "@/features/support/customer-support-page-client";

export const metadata = {
  title: "Support | Norosilk",
  description: "Message the Norosilk team about your orders, payments and deliveries.",
};

export default function AccountSupportPage() {
  return (
    <Suspense
      fallback={
        <div className="account-page support-page">
          <ConversationListSkeleton />
        </div>
      }
    >
      <CustomerSupportPageClient />
    </Suspense>
  );
}
