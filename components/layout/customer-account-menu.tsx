"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api/api-client";
import Button from "@/components/ui/button";

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
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
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
      <div className="account-menu-guest">
        <Link className="text-button" href="/account/login">Sign in</Link>
        <Button href="/account/register" variant="secondary">Create account</Button>
      </div>
    );
  }

  return (
    <div className="account-menu" ref={rootRef}>
      <button
        type="button"
        className="account-menu-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <User size={18} aria-hidden="true" />
        <span>{user.name.split(/\s+/)[0] || "Account"}</span>
      </button>
      {open ? (
        <div className="account-menu-panel" role="menu">
          <p className="account-menu-label">{user.email}</p>
          <Link href="/account/orders" role="menuitem" onClick={() => setOpen(false)}>My orders</Link>
          <Link href="/account/reviews" role="menuitem" onClick={() => setOpen(false)}>My reviews</Link>
          <Link href="/account/orders" role="menuitem" onClick={() => setOpen(false)}>My account</Link>
          <button type="button" role="menuitem" onClick={() => void logout()}>
            <LogOut size={15} aria-hidden="true" /> Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}
