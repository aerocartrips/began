"use client";

import { useState } from "react";

/** Longer than this many characters, a review starts collapsed to a few lines. */
const COLLAPSE_AFTER = 320;

/** Review text; long reviews show a few lines with "Read more". */
export default function ReviewBody({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > COLLAPSE_AFTER;
  return (
    <div className="review-card-text">
      <p className="review-card-body" data-collapsed={long && !expanded ? "" : undefined}>
        {text}
      </p>
      {long ? (
        <button type="button" className="review-card-more" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Show less" : "Read more"}
        </button>
      ) : null}
    </div>
  );
}
