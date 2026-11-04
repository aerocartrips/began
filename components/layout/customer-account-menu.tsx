"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, LayoutDashboard, LogOut, MapPin, MessageSquare, Package, Star, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api/api-client";
import NotificationBell from "@/features/notifications/components/notification-bell";

type PublicUser = {
  _id: string;
  name: string;
  email: string;
};

export default function CustomerAccountMenu() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void apiRequest<PublicUser>("/api/v1/auth/me")
      .then((result) => {
        if (!cancelled) setUser(result.data);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  async function logout() {
    await apiRequest("/api/v1/auth/logout", { method: "POST" });
    setUser(null);
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return <span className="account-menu-placeholder" aria-hidden="true" />;
  }

  if (!user) {
    return (
      <Link className="account-menu-trigger" href="/account/login">
        <User size={15} aria-hidden="true" />
        <span>Sign in</span>
      </Link>
    );
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
          aria-label={`Account menu for ${user.name || user.email}`}
          title={user.name || user.email}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="account-menu-avatar" aria-hidden="true">{(user.name || user.email).charAt(0).toUpperCase()}</span>
        </button>
        {open ? (
          <div className="account-menu-panel" role="menu">
            <div className="account-menu-identity">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
            <Link href="/account" role="menuitem" onClick={() => setOpen(false)}>
              <LayoutDashboard size={15} aria-hidden="true" /> My account
            </Link>
            <Link href="/account/orders" role="menuitem" onClick={() => setOpen(false)}>
              <Package size={15} aria-hidden="true" /> My orders
            </Link>
            <Link href="/account/addresses" role="menuitem" onClick={() => setOpen(false)}>
              <MapPin size={15} aria-hidden="true" /> My addresses
            </Link>
            <Link href="/account/reviews" role="menuitem" onClick={() => setOpen(false)}>
              <Star size={15} aria-hidden="true" /> My reviews
            </Link>
            <Link href="/account/support" role="menuitem" onClick={() => setOpen(false)}>
              <MessageSquare size={15} aria-hidden="true" /> Support
            </Link>
            <Link href="/account/notifications" role="menuitem" onClick={() => setOpen(false)}>
              <Bell size={15} aria-hidden="true" /> Notifications
            </Link>
            <button type="button" role="menuitem" className="account-menu-logout" onClick={() => void logout()}>
              <LogOut size={15} aria-hidden="true" /> Sign out
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
