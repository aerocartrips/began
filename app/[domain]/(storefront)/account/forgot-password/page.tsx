import type { Metadata } from "next";
import AuthCard from "@/components/auth/auth-card";
import ForgotPasswordForm from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Reset your password" lead="Enter the email you sign in with and we'll send you a link to choose a new password.">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
