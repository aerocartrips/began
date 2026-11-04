"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

type Tab = { key: string; label: string; href: string; panel: ReactNode };

/**
 * Best sellers, new arrivals and trending in the space of one row. Every panel
 * is server-rendered into the page (crawlable, no extra requests); tabs only
 * switch which one is visible. Arrow keys move between tabs (WAI-ARIA tabs).
 */
export default function ProductTabs({ headingId, title, description, tabs }: {
  headingId: string;
  title: string;
  description?: string;
  tabs: Tab[];
}) {
  const baseId = useId();
  const [active, setActive] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const current = tabs[active] ?? tabs[0];

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, Home: -active, End: tabs.length - 1 - active };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const next = (active + moves[event.key] + tabs.length) % tabs.length;
    setActive(next);
    buttons.current[next]?.focus();
  }

  return (
    <>
      <div className="home-section__head">
        <div>
          <h2 id={headingId}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        <Link className="home-section__more" href={current.href}>
          View all
          <ArrowRight size={14} aria-hidden="true" />
          <span className="sr-only"> {current.label}</span>
        </Link>
      </div>
      {tabs.length > 1 ? (
        <div className="product-tabs__list" role="tablist" aria-labelledby={headingId}>
          {tabs.map((tab, index) => (
            <button
              key={tab.key}
              ref={(element) => {
                buttons.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.key}`}
              aria-selected={index === active}
              aria-controls={`${baseId}-panel-${tab.key}`}
              tabIndex={index === active ? 0 : -1}
              className="product-tabs__tab"
              onClick={() => setActive(index)}
              onKeyDown={onKeyDown}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}
      {tabs.map((tab, index) => (
        <div
          key={tab.key}
          id={`${baseId}-panel-${tab.key}`}
          role={tabs.length > 1 ? "tabpanel" : undefined}
          aria-labelledby={tabs.length > 1 ? `${baseId}-tab-${tab.key}` : undefined}
          hidden={index !== active}
        >
          {tab.panel}
        </div>
      ))}
    </>
  );
}
