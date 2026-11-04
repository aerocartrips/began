"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Expands the catalogue overview past its first two rows. Every tile is
 * already in the server-rendered list (crawlable); this only flips a data
 * attribute that the CSS reads. Hidden on phones, where the list scrolls sideways.
 */
export default function CatalogueMore({ listId, total }: { listId: string; total: number }) {
  const [expanded, setExpanded] = useState(false);

  function toggle() {
    const next = !expanded;
    document.getElementById(listId)?.setAttribute("data-expanded", String(next));
    setExpanded(next);
  }

  return (
    <button type="button" className="catalogue-more" aria-controls={listId} aria-expanded={expanded} onClick={toggle}>
      {expanded ? "Show fewer categories" : `Show all ${total} categories`}
      <ChevronDown size={15} aria-hidden="true" style={expanded ? { transform: "rotate(180deg)" } : undefined} />
    </button>
  );
}
