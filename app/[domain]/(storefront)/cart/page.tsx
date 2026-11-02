import type { Metadata } from "next";
import CartPageClient from "@/features/cart/components/cart-page-client";

export const metadata: Metadata = {
  title: "Shopping Cart",
  description: "Review the products in your cart.",
};

export default function CartPage() {
  return <CartPageClient />;
}