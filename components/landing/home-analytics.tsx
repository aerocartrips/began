"use client";

import { useEffect } from "react";
import { trackEvent, type AnalyticsEventName } from "@/features/analytics/analytics";
import { RAIL_SCROLL_MILESTONES } from "@/lib/constants/analytics";

/** A section counts as seen once this share of it has been on screen. */
const VISIBLE_SHARE = 0.35;

/**
 * Home page measurement without touching each section's code: one
 * IntersectionObserver records the first time each `[data-home-section]` is
 * seen, one delegated click listener classifies link clicks by where they go
 * (banner, "View all", category, product or other) and which section they
 * were in, and one capturing scroll listener records how far product rows are
 * swiped (half way, to the end), once per row per visit.
 */
export default function HomeAnalytics({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;

    const seen = new Set<string>();
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                const key = (entry.target as HTMLElement).dataset.homeSection;
                if (!entry.isIntersecting || !key || seen.has(key)) continue;
                seen.add(key);
                observer?.unobserve(entry.target);
                trackEvent("section_view", { section: key });
              }
            },
            { threshold: VISIBLE_SHARE },
          );
    root.querySelectorAll<HTMLElement>("[data-home-section]").forEach((element) => observer?.observe(element));

    function onClick(event: MouseEvent) {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement) || !root?.contains(link)) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const section = link.closest<HTMLElement>("[data-home-section]")?.dataset.homeSection ?? "";
      const bannerId = link.closest<HTMLElement>("[data-banner-id]")?.dataset.bannerId;
      const viewAll = link.dataset.viewAll;
      const [, kind, slug] = url.pathname.split("/");
      let name: AnalyticsEventName = "link_click";
      let target = url.pathname;
      if (bannerId) {
        name = "banner_click";
        target = bannerId;
      } else if (viewAll) {
        name = "view_all_click";
        target = viewAll;
      } else if (kind === "categories" && slug) {
        name = "category_click";
        target = slug;
      } else if (kind === "products" && slug) {
        name = "product_click";
        target = slug;
      } else {
        // Keep filter links ("/products?fabric=Silk") distinguishable, but never free-text queries.
        url.searchParams.delete("q");
        target = `${url.pathname}${url.search}`;
      }
      trackEvent(name, { section, target });
    }
    root.addEventListener("click", onClick);

    // Scroll events don't bubble, but a capturing listener on the root sees every row's.
    const reached = new Set<string>();
    const last = RAIL_SCROLL_MILESTONES.at(-1);
    function onScroll(event: Event) {
      const rail = event.target;
      if (!(rail instanceof HTMLElement) || !rail.classList.contains("product-rail")) return;
      const section = rail.closest<HTMLElement>("[data-home-section]")?.dataset.homeSection;
      const scrollable = rail.scrollWidth - rail.clientWidth;
      if (!section || scrollable <= 0 || reached.has(`${section}:${last}`)) return;
      const progress = (rail.scrollLeft / scrollable) * 100;
      for (const milestone of RAIL_SCROLL_MILESTONES) {
        const key = `${section}:${milestone}`;
        // 1% slack: snapping can stop a pixel short of the end.
        if (progress < milestone - 1 || reached.has(key)) continue;
        reached.add(key);
        trackEvent("rail_scroll", { section, target: String(milestone) });
      }
    }
    root.addEventListener("scroll", onScroll, { capture: true, passive: true });

    // Rows that appear after load (personal picks, recently viewed) are top-level children of the root;
    // watching only those keeps feed card appends from triggering any work here.
    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement && node.dataset.homeSection && !seen.has(node.dataset.homeSection)) observer?.observe(node);
        });
      }
    });
    mutations.observe(root, { childList: true });

    return () => {
      observer?.disconnect();
      mutations.disconnect();
      root.removeEventListener("click", onClick);
      root.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [rootId]);

  return null;
}
