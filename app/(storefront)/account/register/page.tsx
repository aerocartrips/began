import CustomerAuthForm from "@/components/auth/customer-auth-form";
import Link from "next/link";
import { Suspense } from "react";
import { ProfileSkeleton } from "@/components/ui/loaders/OrderListSkeleton";

export const metadata = {
  title: "Register | Norosilk",
  description: "Create a wholesale buyer account.",
};

export default function AccountRegisterPage() {
  return (
    <main className="commerce-page content-width">
      <div className="commerce-heading">
        <div>
          <p className="eyebrow">Wholesale account</p>
          <h1>Create account</h1>
        </div>
        <Link className="text-button" href="/products">Back to catalog</Link>
      </div>
      <Suspense fallback={<ProfileSkeleton />}>
        <CustomerAuthForm mode="register" />
      </Suspense>
    </main>
  );
}
