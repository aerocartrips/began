import Link from "next/link";
import SectionHeading from "@/components/ui/section-heading";

export const metadata = {
  title: "Shipping Information | NeoVastra",
  description: "Wholesale shipping and fulfillment information.",
};

export default function ShippingPage() {
  return (
    <main className="commerce-page content-width">
      <SectionHeading title="Shipping information" subtitle="Wholesale fulfillment for verified buyers" />
      <div className="commerce-copy">
        <p>
          Shipping terms, export documentation, and batch dispatch schedules are confirmed with your account
          manager after order placement. Track active orders from{" "}
          <Link href="/account/orders">My Orders</Link>.
        </p>
        <p>
          Need help before checkout? <Link href="/contact">Contact us</Link> with your destination market and MOQ requirements.
        </p>
      </div>
    </main>
  );
}
