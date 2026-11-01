import CustomerOrdersPageClient from "@/features/orders/customer-orders-page-client";

export const metadata = {
  title: "My Orders | Norosilk",
  description: "Track and manage your wholesale orders.",
};

export default function AccountOrdersPage() {
  return <CustomerOrdersPageClient />;
}
