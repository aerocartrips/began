import type { Metadata } from "next";
import TrackOrderClient from "@/features/orders/track-order-client";
import { pageMetadata, siteNameOf } from "@/lib/seo/metadata";
import { getCurrentTenant } from "@/lib/tenant/current";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getCurrentTenant();
  return pageMetadata(tenant, {
    title: "Track your order",
    description: `Check the status and delivery of your ${siteNameOf(tenant)} order with your order number.`,
    path: "/track-order",
  });
}

export default function TrackOrderPage() {
  return <TrackOrderClient />;
}
