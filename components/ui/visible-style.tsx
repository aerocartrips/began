"use client";

import { useCallback } from "react";

/**
 * A page-level <style> that applies only while its page is on screen.
 *
 * Next keeps recently visited pages mounted but hidden (React <Activity>), and
 * a stylesheet applies wherever it sits in the DOM, so global CSS from a hidden
 * page (or an `html:has(...)` rule matching it) would leak into the page now
 * showing. React detaches refs when Activity hides a subtree and re-attaches
 * them when it returns, so the ref switches the sheet off and on with its page.
 * The server HTML has it on, so the first paint is right before any script runs.
 * See node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md ("Global styles").
 */
export default function VisibleStyle({ css, media = "all" }: { css: string; media?: string }) {
  const toggle = useCallback(
    (sheet: HTMLStyleElement | null) => {
      if (!sheet) return;
      sheet.media = media;
      return () => {
        sheet.media = "not all";
      };
    },
    [media],
  );
  return (
    <style ref={toggle} media={media}>
      {css}
    </style>
  );
}
