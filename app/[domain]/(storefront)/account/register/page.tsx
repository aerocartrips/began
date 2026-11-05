import type { Metadata } from "next";
import AuthPage, { type AuthSearchParams } from "@/components/auth/auth-page";

export const metadata: Metadata = {
  title: "Register",
  description: "Create a wholesale buyer account.",
  robots: { index: false, follow: true },
};

export default function AccountRegisterPage({ searchParams }: { searchParams: AuthSearchParams }) {
  return <AuthPage mode="register" searchParams={searchParams} />;
}
