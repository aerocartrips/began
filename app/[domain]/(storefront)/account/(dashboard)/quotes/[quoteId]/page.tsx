import Link from "next/link";
import { CustomerQuoteDetail } from "@/features/quotes/customer-quotes";

export const metadata = { title: "Quote details" };

export default async function AccountQuotePage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  return (
    <div className="account-page">
      <Link className="account-back-link" href="/account/quotes">← All quotes</Link>
      <CustomerQuoteDetail quoteId={quoteId} />
    </div>
  );
}
