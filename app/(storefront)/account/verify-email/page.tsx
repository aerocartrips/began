import { Suspense } from "react";
import { ProfileSkeleton } from "@/components/ui/loaders/order-list-skeleton";
import VerifyEmailClient from "@/features/account/components/verify-email-client";

export const metadata = {
  title: "Verify Email | Norosilk",
  robots: { index: false },
};

type VerifyEmailPageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

async function VerifyEmailContent({ searchParams }: VerifyEmailPageProps) {
  const { token } = await searchParams;
  return <VerifyEmailClient token={typeof token === "string" ? token : ""} />;
}

export default function VerifyEmailPage(props: VerifyEmailPageProps) {
  return (
    <main className="commerce-page content-width account-verify-page">
      <div className="commerce-heading">
        <div>
          <p className="eyebrow">Wholesale account</p>
          <h1>Verify email</h1>
        </div>
      </div>
      <Suspense fallback={<ProfileSkeleton />}>
        <VerifyEmailContent searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
