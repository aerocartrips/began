import type { ReactNode } from "react";
import SiteFooter from "@/components/layout/site-footer";
import SiteHeader from "@/components/layout/site-header";
import { CartProvider } from "@/features/cart/cart-provider";

type SiteShellProps = {
  children: ReactNode;
};

export default function SiteShell({ children }: SiteShellProps) {
  return (
    <CartProvider>
      <SiteHeader />
      {children}
      <SiteFooter />
    </CartProvider>
  );
}
