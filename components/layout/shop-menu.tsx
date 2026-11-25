"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, LayoutGrid } from "lucide-react";
import ProductTypeIcon from "@/components/catalog/product-type-icon";
import { formatNumber } from "@/lib/format";
import { inSentence } from "@/lib/catalog/words";

export type ShopMenuLink = { name: string; slug: string };
export type ShopMenuType = { name: string; slug: string; icon: string; count: number; categories: ShopMenuLink[] };

/**
 * The header's "Shop" for stores that sell several product types: a mega menu
 * (the WAI-ARIA disclosure pattern for site navigation, with real links) with
 * a column per type, its largest categories under it, then "Collections" for
 * categories that mix types. Closes on Escape, on a click outside and when a
 * link is followed.
 */
export default function ShopMenu({ types, collections }: { types: ShopMenuType[]; collections: ShopMenuLink[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={rootRef} className="shop-menu">
      <button
        ref={buttonRef}
        type="button"
        className="shop-menu__trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        Shop <ChevronDown size={13} strokeWidth={2} aria-hidden="true" />
      </button>
      <div id={panelId} className="shop-menu__panel" hidden={!open}>
        <div className="shop-menu__columns" data-count={types.length + (collections.length ? 1 : 0)}>
          {types.map((type) => (
            <div key={type.slug} className="shop-menu__column">
              <Link href={`/shop/${type.slug}`} className="shop-menu__type" onClick={close}>
                <span className="shop-menu__icon">
                  <ProductTypeIcon icon={type.icon} />
                </span>
                <span className="shop-menu__name">{type.name}</span>
                <span className="shop-menu__count">{formatNumber(type.count)}</span>
              </Link>
              {type.categories.length ? (
                <ul aria-label={`${type.name} categories`}>
                  {type.categories.map((category) => (
                    <li key={category.slug}>
                      <Link href={`/categories/${category.slug}`} className="shop-menu__category" onClick={close}>
                        {category.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              <Link href={`/shop/${type.slug}`} className="shop-menu__all" onClick={close}>
                All {inSentence(type.name)}
                <ArrowRight size={12} aria-hidden="true" />
              </Link>
            </div>
          ))}
          {collections.length ? (
            <div className="shop-menu__column">
              <span className="shop-menu__type shop-menu__type--plain">
                <span className="shop-menu__icon">
                  <LayoutGrid size={16} aria-hidden="true" />
                </span>
                <span className="shop-menu__name">Collections</span>
              </span>
              <ul aria-label="Collections">
                {collections.map((category) => (
                  <li key={category.slug}>
                    <Link href={`/categories/${category.slug}`} className="shop-menu__category" onClick={close}>
                      {category.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <div className="shop-menu__foot">
          <Link href="/products" onClick={close}>All products</Link>
          <Link href="/categories" onClick={close}>All categories</Link>
        </div>
      </div>
    </div>
  );
}
