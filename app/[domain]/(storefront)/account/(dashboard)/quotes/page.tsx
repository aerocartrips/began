import { notFound } from "next/navigation";
import { CustomerQuoteList } from "@/features/quotes/customer-quotes";
import { getCurrentTenant } from "@/lib/tenant/current";

export const metadata = { title: "My quotes" };

export default async function AccountQuotesPage() {
  if ((await getCurrentTenant()).salesMode !== "wholesale") notFound();
  return (
    <div className="account-page">
      <div className="commerce-heading">
        <div>
          <p className="eyebrow">Wholesale account</p>
          <h1>My quotes</h1>
          <p className="account-lead">Quote requests and the offers our team has sent you.</p>
        </div>
      </div>
      <CustomerQuoteList />
    </div>
  );
}
