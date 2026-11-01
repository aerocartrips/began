import Link from "next/link";
import { CreditCard, PackageOpen, XCircle } from "lucide-react";
import SupportInfoPage from "@/components/support/support-info-page";

export const metadata = {
  title: "Returns & Refunds | Norosilk",
  description: "Return requests and refund processing for wholesale orders.",
};

export default function ReturnsPage() {
  return (
    <SupportInfoPage
      eyebrow="Post-delivery support"
      title="Returns & refunds"
      description="Request returns, cancel eligible orders, and follow refund status from your account."
      ctaTitle="Questions about our policy?"
      items={[
        {
          icon: PackageOpen,
          title: "Request a return",
          body: (
            <>
              Eligible delivered orders can submit a return request from the order detail page in{" "}
              <Link href="/account/orders">My Orders</Link>.
            </>
          ),
        },
        {
          icon: XCircle,
          title: "Cancellations",
          body: "Orders that have not yet shipped can be cancelled from the order detail page with a short reason.",
        },
        {
          icon: CreditCard,
          title: "Refunds",
          body: "Refunds for paid orders are processed through our payment provider after cancellation or an approved return. Status is shown on your order detail page.",
        },
      ]}
    />
  );
}
