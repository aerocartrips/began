"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import {
  ChevronRight,
  FileText,
  Heart,
  LayoutGrid,
  Mail,
  Menu,
  MessageSquare,
  Package,
  Phone,
  Shapes,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import BrandLink from "@/components/ui/brand-link";
import { useTenant } from "@/features/tenant/tenant-provider";
import { getFooterColumns, type NavigationItem } from "@/lib/site-content";

const ICONS: Record<string, LucideIcon> = {
  "/products": LayoutGrid,
  "/categories": Shapes,
  "/wishlist": Heart,
  "/request-quote": FileText,
  "/account": UserRound,
  "/account/orders": Package,
  "/account/quotes": FileText,
  "/account/support": MessageSquare,
};

/** The footer's link groups, each link listed once (the first group that has it keeps it). */
function menuSections(columns: ReturnType<typeof getFooterColumns>, skip: string[]) {
  const seen = new Set(skip);
  const unique = (links: readonly NavigationItem[]) =>
    links.filter((link) => {
      if (seen.has(link.href)) return false;
      seen.add(link.href);
      return true;
    });
  return [
    { title: "Shop", links: unique(columns.shop), compact: false },
    { title: "Your account", links: unique(columns.account), compact: false },
    { title: "Help", links: unique(columns.help), compact: true },
    { title: "Company", links: unique(columns.legal), compact: true },
  ].filter((section) => section.links.length > 0);
}

function isCurrent(pathname: string, href: string) {
  return href === "/account" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Site menu for phones and tablets: a drawer built on the native <dialog>
 * (focus trap, Escape and an inert page come with it). Closes on any link tap
 * and on back/forward. It reads the current page only when opened, so the
 * header never waits on the URL (see usePathname with Cache Components).
 */
export default function MobileMenu() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pathname, setPathname] = useState("");
  const { salesMode, contact } = useTenant();
  const wholesale = salesMode === "wholesale";
  const sections = menuSections(getFooterColumns(salesMode), wholesale ? ["/request-quote"] : []);

  useEffect(() => {
    const close = () => dialogRef.current?.close();
    window.addEventListener("popstate", close);
    return () => window.removeEventListener("popstate", close);
  }, []);

  function onDialogClick(event: MouseEvent<HTMLDialogElement>) {
    // The backdrop belongs to the dialog element itself; links close the menu as they navigate.
    const target = event.target as Element;
    if (target === event.currentTarget || target.closest("a")) event.currentTarget.close();
  }

  function open() {
    const dialog = dialogRef.current;
    if (!dialog) return;
    setPathname(window.location.pathname);
    dialog.showModal();
    // Start on the close button rather than the logo, as native drawers do.
    dialog.querySelector<HTMLElement>(".mobile-drawer__close")?.focus();
  }

  return (
    <>
      <button
        type="button"
        className="mobile-menu-trigger"
        aria-label="Open menu"
        aria-haspopup="dialog"
        onClick={open}
      >
        <Menu size={22} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <dialog ref={dialogRef} className="mobile-drawer" aria-label="Menu" onClick={onDialogClick}>
        <div className="mobile-drawer__panel">
          <div className="mobile-drawer__head">
            <BrandLink href="/" />
            <button type="button" className="mobile-drawer__close" aria-label="Close menu" onClick={() => dialogRef.current?.close()}>
              <X size={22} aria-hidden="true" />
            </button>
          </div>
          <nav className="mobile-drawer__body" aria-label="Site">
            {wholesale ? (
              <Link className="button button-primary mobile-drawer__cta" href="/request-quote">
                <FileText size={17} aria-hidden="true" /> Request a quote
              </Link>
            ) : null}
            {sections.map((section) => (
              <section key={section.title} className="mobile-drawer__section">
                <h2>{section.title}</h2>
                <ul className={section.compact ? "mobile-drawer__links is-compact" : "mobile-drawer__links"}>
                  {section.links.map((link) => {
                    const Icon = section.compact ? null : ICONS[link.href];
                    return (
                      <li key={link.href}>
                        <Link
                          className="mobile-drawer__link"
                          href={link.href}
                          aria-current={isCurrent(pathname, link.href) ? "page" : undefined}
                        >
                          {Icon ? <Icon size={19} strokeWidth={1.8} aria-hidden="true" /> : null}
                          <span>{link.label}</span>
                          {section.compact ? null : <ChevronRight className="mobile-drawer__chevron" size={17} aria-hidden="true" />}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </nav>
          {contact.phone || contact.email ? (
            <div className="mobile-drawer__contact">
              {contact.phone ? (
                <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}>
                  <Phone size={17} aria-hidden="true" /> {contact.phone}
                </a>
              ) : null}
              {contact.email ? (
                <a href={`mailto:${contact.email}`}>
                  <Mail size={17} aria-hidden="true" /> {contact.email}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
