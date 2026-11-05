import { Suspense, type ReactNode } from "react";
import MobileTabBar, { MobileTabBarFallback } from "@/components/layout/mobile-tab-bar";
import SiteFooter from "@/components/layout/site-footer";
import SiteHeader from "@/components/layout/site-header";

export default function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
      <Suspense fallback={<MobileTabBarFallback />}>
        <MobileTabBar />
      </Suspense>
    </>
  );
}
