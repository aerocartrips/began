import type { Metadata } from "next";
import CartPageClient from "@/features/cart/components/cart-page-client";

export const metadata: Metadata = {
  title: "Shopping Cart | NeoVastra",
  description: "Review your NeoVastra wholesale product selection.",
};

export default function CartPage() {
  return <CartPageClient />;
}