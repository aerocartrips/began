"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, LayoutDashboard, LogOut, MapPin, MessageSquare, Package, Star, User, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useOptionalFeedback } from "@/components/feedback/feedback-provider";
import { completeSignOut, reconcileSessionCookies, resetSessionState } from "@/features/account/session-transitions";
import NotificationBell from "@/features/notifications/components/notification-bell";
import { apiRequest } from "@/lib/api/api-client";
import { authHref, returnPathFor } from "@/lib/auth/redirect";
import type { SessionUser } from "@/lib/auth/session-user";
import { onSessionChange } from "@/lib/client/session-events";

const MENU_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/account", label: "My account", icon: LayoutDashboard },
  { href: "/account/orders", label: "My orders", icon: Package },
  { href: "/account/addresses", label: "My addresses", icon: MapPin },
  { href: "/account/reviews", label: "My reviews", icon: Star },
  { href: "/account/support", label: "Support", icon: MessageSquare },
  { href: "/account/notifications", label: "Notifications", icon: Bell },
];

type CustomerAccountMenuProps = {
  /** From the server-rendered session (see HeaderAccount). */
  user: SessionUser | null;
  /** The access token expired or the cookies are dead: renew or clear them in the background. */
  reconcile: boolean;
};

/**
 * Header account control. The session comes from the server as props, so the
 * browser makes no session request to draw it, and router.refresh() after a
 * sign-in or sign-out updates it.
 */
export default function CustomerAccountMenu({ user, reconcile }: CustomerAccountMenuProps) {
  const router = useRouter();
  const signedIn = user !== null;

  // Another tab signed in or out: re-render this tab's server UI with the new session.
  useEffect(
    () =>
      onSessionChange(() => {
        resetSessionState();
        router.refresh();
      }),
    [router],
  );

  useEffect(() => {
    if (!reconcile) return;
    void reconcileSessionCookies().then((authenticated) => {
      // Only when the session ended in the meantime does the header need a new render.
      if (authenticated !== null && authenticated !== signedIn) router.refresh();
    });
  }, [reconcile, signedIn, router]);

  return user ? <AccountMenu user={user} /> : <SignedOutControls />;
}

/**
 * Guests see the same controls as signed-in shoppers. The bell leads to
 * sign-in and then to the notifications; "Sign in" returns to this page
 * (with its filters).
 */
function SignedOutControls() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (
    <>
      <div className="notification-bell notification-bell--customer">
        <Link
          className="notification-bell__trigger"
          href={authHref("/account/notifications")}
          aria-label="Notifications: sign in to see yours"
          title="Sign in to see your notifications"
        >
          <Bell size={18} strokeWidth={1.8} aria-hidden="true" />
        </Link>
      </div>
      <Link
        className="account-menu-trigger account-menu-trigger--icon"
        href={authHref(returnPathFor(pathname, searchParams))}
        aria-label="Sign in"
        title="Sign in"
      >
        <User size={16} strokeWidth={1.85} aria-hidden="true" />
      </Link>
    </>
  );
}

function AccountMenu({ user }: { user: SessionUser }) {
  const feedback = useOptionalFeedback();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const displayName = user.name || user.email;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function signOut() {
    setSigningOut(true);
    try {
      await apiRequest("/api/v1/auth/logout", { method: "POST" });
      completeSignOut("/");
    } catch (error) {
      setSigningOut(false);
      feedback?.error("Sign out failed", error instanceof Error ? error.message : undefined);
    }
  }

  return (
    <>
      <NotificationBell scope="customer" />
      <div className="account-menu" ref={rootRef}>
        <button
          type="button"
          className="account-menu-trigger account-menu-trigger--icon"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={`Account menu for ${displayName}`}
          title={displayName}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="account-menu-avatar" aria-hidden="true">
            {user.avatarUrl ? (
              <Image src={user.avatarUrl} alt="" fill sizes="26px" className="cover-image" />
            ) : (
              displayName.charAt(0).toUpperCase()
            )}
          </span>
        </button>
        {open ? (
          <div className="account-menu-panel" role="menu">
            <div className="account-menu-identity">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
            {MENU_LINKS.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} role="menuitem" onClick={() => setOpen(false)}>
                <Icon size={15} aria-hidden="true" /> {label}
              </Link>
            ))}
            <button
              type="button"
              role="menuitem"
              className="account-menu-logout"
              disabled={signingOut}
              onClick={() => void signOut()}
            >
              <LogOut size={15} aria-hidden="true" /> {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
