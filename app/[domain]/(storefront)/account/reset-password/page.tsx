import type { Metadata } from "next";
import { Suspense } from "react";
import AuthCard from "@/components/auth/auth-card";
import ResetPasswordForm from "@/components/auth/reset-password-form";
import { ProfileSkeleton } from "@/components/ui/loaders/order-list-skeleton";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

async function ResetPasswordContent({ searchParams }: ResetPasswordPageProps) {
  const { token } = await searchParams;
  return <ResetPasswordForm token={typeof token === "string" ? token : ""} />;
}

export default function ResetPasswordPage(props: ResetPasswordPageProps) {
  return (
    <AuthCard title="Choose a new password" lead="Pick a password you don't use anywhere else.">
      <Suspense fallback={<ProfileSkeleton />}>
        <ResetPasswordContent searchParams={props.searchParams} />
      </Suspense>
    </AuthCard>
  );
}
