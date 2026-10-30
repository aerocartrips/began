import CustomerReviewsPageClient from "@/features/reviews/customer-reviews-page-client";

export const metadata = {
  title: "My Reviews | NeoVastra",
  description: "Manage your verified purchase product reviews.",
};

export default function AccountReviewsPage() {
  return <CustomerReviewsPageClient />;
}
