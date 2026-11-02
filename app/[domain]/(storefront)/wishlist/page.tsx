import type { Metadata } from "next";
import WishlistPageClient from "@/features/wishlist/wishlist-page-client";

export const metadata: Metadata = {
  title: "Wishlist",
  robots: { index: false, follow: true },
};

export default function WishlistPage() {
  return <WishlistPageClient />;
}
