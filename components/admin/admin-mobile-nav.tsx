"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import Link from "next/link";
import { Activity, ExternalLink, Menu, X } from "lucide-react";
import AdminNavigation from "@/components/admin/admin-navigation";

/** Admin navigation on phones and small tablets: a drawer that closes on link taps and back/forward. */
export default function AdminMobileNav({ storeName }: { storeName: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const close = () => dialogRef.current?.close();
    window.addEventListener("popstate", close);
    return () => window.removeEventListener("popstate", close);
  }, []);

  function onDialogClick(event: MouseEvent<HTMLDialogElement>) {
    const target = event.target as Element;
    if (target === event.currentTarget || target.closest("a")) event.currentTarget.close();
  }

  function open() {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    dialog.querySelector<HTMLElement>(".mobile-drawer__close")?.focus();
  }

  return (
    <>
      <button
        type="button"
        className="admin-menu-trigger"
        aria-label="Open admin menu"
        aria-haspopup="dialog"
        onClick={open}
      >
        <Menu size={20} aria-hidden="true" />
      </button>
      <dialog ref={dialogRef} className="mobile-drawer admin-drawer" aria-label="Admin menu" onClick={onDialogClick}>
        <div className="mobile-drawer__panel">
          <div className="mobile-drawer__head">
            <Link className="admin-wordmark" href="/admin">
              <span className="admin-mark"><Activity size={17} aria-hidden="true" /></span>
              <span>{storeName.toUpperCase()} <small>ADMIN</small></span>
            </Link>
            <button type="button" className="mobile-drawer__close" aria-label="Close menu" onClick={() => dialogRef.current?.close()}>
              <X size={22} aria-hidden="true" />
            </button>
          </div>
          <div className="mobile-drawer__body">
            <AdminNavigation variant="drawer" />
          </div>
          <Link className="admin-store-link" href="/">
            <ExternalLink size={15} aria-hidden="true" />
            View storefront
          </Link>
        </div>
      </dialog>
    </>
  );
}
