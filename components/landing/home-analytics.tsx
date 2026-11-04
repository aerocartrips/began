"use client";

import { useEffect } from "react";
import { trackEvent, type AnalyticsEventName } from "@/features/analytics/analytics";

/** A section counts as seen once this share of it has been on screen. */
const VISIBLE_SHARE = 0.35;

/**
 * Home page measurement without touching each section's code: one
 * IntersectionObserver records the first time each `[data-home-section]` is
 * seen, and one delegated click listener classifies link clicks by where they
 * go (banner, category, product or other) and which section they were in.
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
      const [, kind, slug] = url.pathname.split("/");
      let name: AnalyticsEventName = "link_click";
      let target = url.pathname;
      if (bannerId) {
        name = "banner_click";
        target = bannerId;
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
    };
  }, [rootId]);

  return null;
}
