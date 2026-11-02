import { Suspense } from "react";
import Link from "next/link";
import AccountHeading from "@/features/account/components/account-heading";
import AccountSettings from "@/features/account/components/account-settings";
import { AccountSectionSkeleton } from "@/features/account/components/account-skeletons";
import { requireAccountUser } from "@/lib/auth/current-customer";
import { toAccountProfile, toDeletionRequest, toPreferences } from "@/lib/services/account-dto";
import { formatDate } from "@/lib/format";
import type { DeletionRequest } from "@/features/account/types";

export const metadata = {
  title: "Account Settings",
  description: "Review your account, download your data or request deletion.",
};

async function SettingsContent() {
  const user = await requireAccountUser("/account/settings");
  const profile = toAccountProfile(user);
  const preferences = toPreferences(user);
  const enabled = [preferences.orderUpdates && "order", preferences.shippingUpdates && "shipping", preferences.promotional && "promotional"].filter(Boolean);

  return (
    <div className="account-stack">
      <section className="account-panel" aria-labelledby="settings-summary-title">
        <div className="account-panel-head">
          <h2 id="settings-summary-title">Account information</h2>
          <Link href="/account/profile" className="account-link-button">Edit profile</Link>
        </div>
        <dl className="account-facts">
          <div><dt>Account holder</dt><dd>{profile.name}</dd></div>
          <div><dt>Email</dt><dd>{profile.email}</dd></div>
          <div><dt>Account type</dt><dd>Wholesale buyer</dd></div>
          <div><dt>Member since</dt><dd>{formatDate(profile.createdAt)}</dd></div>
        </dl>
      </section>

      <section className="account-panel" aria-labelledby="settings-notifications-title">
        <div className="account-panel-head">
          <h2 id="settings-notifications-title">Notifications</h2>
          <Link href="/account/preferences" className="account-link-button">Manage</Link>
        </div>
        <p className="account-muted">
          {enabled.length ? `You receive ${enabled.join(", ")} emails.` : "All optional emails are turned off."} Essential payment and security emails are always sent.
        </p>
      </section>

      <AccountSettings initialDeletion={toDeletionRequest(user) as DeletionRequest} />
    </div>
  );
}

export default function AccountSettingsPage() {
  return (
    <>
      <AccountHeading title="Account settings" lead="Review your account, manage your data and privacy." />
      <Suspense fallback={<AccountSectionSkeleton panels={3} />}>
        <SettingsContent />
      </Suspense>
    </>
  );
}
