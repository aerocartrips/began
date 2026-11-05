"use client";

import { useEffect, useRef } from "react";
import { Search } from "lucide-react";
import StorefrontSearch from "@/components/layout/storefront-search";

/**
 * Phone search: a header button that opens search full screen, so suggestions
 * get the whole screen and the keyboard opens straight away. The sheet closes
 * itself when it navigates, and on back/forward.
 */
export default function MobileSearch() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const close = () => dialogRef.current?.close();
    window.addEventListener("popstate", close);
    return () => window.removeEventListener("popstate", close);
  }, []);

  function open() {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    // Focusing inside the tap handler is what lets iOS raise the keyboard.
    dialog.querySelector("input")?.focus();
  }

  const close = () => dialogRef.current?.close();

  return (
    <>
      <button type="button" className="cart-link mobile-search-trigger" aria-label="Search products" aria-haspopup="dialog" onClick={open}>
        <Search size={20} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <dialog ref={dialogRef} className="search-sheet" aria-label="Search products">
        <StorefrontSearch variant="sheet" onNavigate={close} onCancel={close} />
      </dialog>
    </>
  );
}
