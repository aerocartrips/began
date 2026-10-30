import CustomerAuthForm from "@/components/auth/customer-auth-form";
import Link from "next/link";
import { Suspense } from "react";
import { ProfileSkeleton } from "@/components/ui/loaders/OrderListSkeleton";

export const metadata = {
  title: "Sign in | Norosilk",
  description: "Sign in to place wholesale saree orders.",
};

export default function AccountLoginPage() {
  return (
    <main className="commerce-page content-width">
      <div className="commerce-heading">
        <div>
          <p className="eyebrow">Wholesale account</p>
          <h1>Sign in</h1>
        </div>
        <Link className="text-button" href="/products">Back to catalog</Link>
      </div>
      <Suspense fallback={<ProfileSkeleton />}>
        <CustomerAuthForm mode="login" />
      </Suspense>
    </main>
  );
}
