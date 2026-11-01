import Link from "next/link";
import { FileText, MapPin, Truck } from "lucide-react";
import SupportInfoPage from "@/components/support/support-info-page";

export const metadata = {
  title: "Shipping Information | Norosilk",
  description: "Wholesale shipping and fulfillment information.",
};

export default function ShippingPage() {
  return (
    <SupportInfoPage
      eyebrow="Wholesale fulfilment"
      title="Shipping information"
      description="How verified wholesale orders are dispatched, documented, and tracked."
      ctaTitle="Planning a shipment?"
      items={[
        {
          icon: FileText,
          title: "Terms & documentation",
          body: "Shipping terms, export documentation, and batch dispatch schedules are confirmed with your account manager after order placement.",
        },
        {
          icon: Truck,
          title: "Track your orders",
          body: (
            <>
              Courier tracking appears on each order once an AWB is assigned. Follow active orders from{" "}
              <Link href="/account/orders">My Orders</Link>.
            </>
          ),
        },
        {
          icon: MapPin,
          title: "Before checkout",
          body: (
            <>
              <Link href="/contact">Contact us</Link> with your destination market and MOQ requirements and we will confirm options.
            </>
          ),
        },
      ]}
    />
  );
}
