import { Suspense } from "react";
import AccountHeading from "@/features/account/components/account-heading";
import { AccountSectionSkeleton } from "@/features/account/components/account-skeletons";
import ProfileForm from "@/features/account/components/profile-form";
import { requireAccountUser } from "@/lib/auth/current-customer";
import { getProfile } from "@/lib/services/account.service";
import type { AccountCapabilities, AccountProfile } from "@/features/account/types";

export const metadata = {
  title: "Personal Information",
  description: "Update your name, contact details and business information.",
};

async function ProfileContent() {
  const user = await requireAccountUser("/account/profile");
  const { profile, capabilities } = getProfile(user);
  return <ProfileForm initialProfile={profile as AccountProfile} capabilities={capabilities as AccountCapabilities} />;
}

export default function AccountProfilePage() {
  return (
    <>
      <AccountHeading title="Personal information" lead="Keep your contact and business details up to date for orders and GST invoices." />
      <Suspense fallback={<AccountSectionSkeleton />}>
        <ProfileContent />
      </Suspense>
    </>
  );
}
