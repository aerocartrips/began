import { Suspense } from "react";
import AccountHeading from "@/features/account/components/account-heading";
import { AccountSectionSkeleton } from "@/features/account/components/account-skeletons";
import SecurityPanel from "@/features/account/components/security-panel";
import { requireAccountUser } from "@/lib/auth/current-customer";
import { getSecurityOverview } from "@/lib/services/account-security.service";
import type { SecurityOverview } from "@/features/account/types";

export const metadata = {
  title: "Security | Norosilk",
  description: "Change your password and manage signed-in devices.",
};

async function SecurityContent() {
  const user = await requireAccountUser("/account/security");
  const overview = (await getSecurityOverview(user)) as SecurityOverview;
  return <SecurityPanel overview={overview} />;
}

export default function AccountSecurityPage() {
  return (
    <>
      <AccountHeading title="Security" lead="Manage your password and where you are signed in." />
      <Suspense fallback={<AccountSectionSkeleton panels={3} />}>
        <SecurityContent />
      </Suspense>
    </>
  );
}
