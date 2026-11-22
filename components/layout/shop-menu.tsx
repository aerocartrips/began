"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import ProductTypeIcon from "@/components/catalog/product-type-icon";
import { formatNumber } from "@/lib/format";

export type ShopMenuType = { name: string; slug: string; icon: string; count: number };

/**
 * The header's "Shop" link for stores that sell several product types: a
 * disclosure (the WAI-ARIA pattern for site navigation, with real links)
 * listing everything, each type and the categories. Closes on Escape, on a
 * click outside and when a link is followed.
 */
export default function ShopMenu({ types }: { types: ShopMenuType[] }) {
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
        <ul>
          {types.map((type) => (
            <li key={type.slug}>
              <Link href={`/shop/${type.slug}`} className="shop-menu__link" onClick={close}>
                <span className="shop-menu__icon">
                  <ProductTypeIcon icon={type.icon} />
                </span>
                <span className="shop-menu__name">{type.name}</span>
                <span className="shop-menu__count">{formatNumber(type.count)}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="shop-menu__foot">
          <Link href="/products" onClick={close}>All products</Link>
          <Link href="/categories" onClick={close}>Categories</Link>
        </div>
      </div>
    </div>
  );
}
