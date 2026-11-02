import type { Metadata } from "next";
import TrackOrderClient from "@/features/orders/track-order-client";

export const metadata: Metadata = {
  title: "Track your order",
  description: "Check your order and shipment status.",
};

export default function TrackOrderPage() {
  return <TrackOrderClient />;
}
