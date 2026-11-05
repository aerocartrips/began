import type { Metadata } from "next";
import AuthPage, { type AuthSearchParams } from "@/components/auth/auth-page";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to place wholesale saree orders.",
  robots: { index: false, follow: true },
};

export default function AccountLoginPage({ searchParams }: { searchParams: AuthSearchParams }) {
  return <AuthPage mode="login" searchParams={searchParams} />;
}
