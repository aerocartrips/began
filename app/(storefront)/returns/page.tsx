import Link from "next/link";
import SectionHeading from "@/components/ui/section-heading";

export const metadata = {
  title: "Returns & Refunds | NeoVastra",
  description: "Return requests and refund processing for wholesale orders.",
};

export default function ReturnsPage() {
  return (
    <main className="commerce-page content-width">
      <SectionHeading title="Returns & refunds" subtitle="Post-delivery support for wholesale orders" />
      <div className="commerce-copy">
        <p>
          Eligible delivered orders can submit a return request from the order detail page in{" "}
          <Link href="/account/orders">My Orders</Link>. Refunds for paid orders are processed through our payment
          provider after cancellation or approved returns — status is shown on your order detail page.
        </p>
        <p>
          For policy questions before purchase, please <Link href="/contact">contact our team</Link>.
        </p>
      </div>
    </main>
  );
}
