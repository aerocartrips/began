import type { Metadata } from "next";
import Link from "next/link";
import AdminLoginForm from "@/components/admin/login-form";

export const metadata: Metadata = {
  title: "Admin Sign In | Norosilk",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <main className="admin-login-page">
      <section className="admin-login-panel" aria-labelledby="admin-login-title">
        <Link className="admin-login-brand" href="/">NOROSILK</Link>
        <p className="admin-eyebrow">Store administration</p>
        <h1 id="admin-login-title">Sign in to your admin account</h1>
        <p className="admin-login-description">
          Authorized administrators only. Sign-in activity is rate limited.
        </p>
        <AdminLoginForm />
      </section>
    </main>
  );
}