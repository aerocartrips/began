import type { HTMLAttributes } from "react";
import VisibleStyle from "@/components/ui/visible-style";
import { PHONE_QUERY } from "@/lib/constants/breakpoints";

/** Read by --bottom-ui and the tab bar in app/mobile.css. */
const TAKE_BOTTOM_EDGE = ":root { --action-bar-space: calc(var(--action-bar-h) + env(safe-area-inset-bottom, 0px)); --tabbar-display: none; }";

/**
 * A page's own bar fixed to the bottom of phone screens (product, cart,
 * checkout), so the price or total and the next step stay within thumb reach.
 * While its page is on screen it takes the bottom edge from the tab bar.
 */
export default function MobileActionBar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <>
      <VisibleStyle css={TAKE_BOTTOM_EDGE} media={PHONE_QUERY} />
      <div {...props} className={className ? `mobile-action-bar ${className}` : "mobile-action-bar"} />
    </>
  );
}
