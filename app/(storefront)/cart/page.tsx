import type { Metadata } from "next";
import CartPageClient from "@/features/cart/components/cart-page-client";

export const metadata: Metadata = {
  title: "Shopping Cart | Norosilk",
  description: "Review your Norosilk wholesale product selection.",
};

export default function CartPage() {
  return <CartPageClient />;
}