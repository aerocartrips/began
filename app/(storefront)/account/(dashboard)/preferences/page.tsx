import { Suspense } from "react";
import AccountHeading from "@/features/account/components/account-heading";
import { AccountSectionSkeleton } from "@/features/account/components/account-skeletons";
import PreferencesForm from "@/features/account/components/preferences-form";
import { requireAccountUser } from "@/lib/auth/current-customer";
import { getPreferences } from "@/lib/services/account.service";
import type { NotificationPreferences } from "@/features/account/types";

export const metadata = {
  title: "Preferences | Norosilk",
  description: "Choose which emails and notifications you receive from Norosilk.",
};

async function PreferencesContent() {
  const user = await requireAccountUser("/account/preferences");
  return <PreferencesForm initialPreferences={getPreferences(user) as NotificationPreferences} />;
}

export default function AccountPreferencesPage() {
  return (
    <>
      <AccountHeading title="Preferences" lead="Choose the updates you want to hear about." />
      <Suspense fallback={<AccountSectionSkeleton />}>
        <PreferencesContent />
      </Suspense>
    </>
  );
}
