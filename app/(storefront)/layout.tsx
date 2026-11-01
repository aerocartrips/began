import type { ReactNode } from "react";
import SiteShell from "@/components/layout/site-shell";
import FeedbackContainer from "@/components/feedback/feedback-container";
import { FeedbackProvider } from "@/components/feedback/feedback-provider";
import { CartProvider } from "@/features/cart/cart-provider";

export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return (
    <FeedbackProvider>
      <CartProvider>
        <SiteShell>{children}</SiteShell>
        <FeedbackContainer />
      </CartProvider>
    </FeedbackProvider>
  );
}