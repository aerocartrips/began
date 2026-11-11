import { Suspense, type ReactNode } from "react";
import Image from "next/image";
import AccountNav from "@/features/account/components/account-nav";
import { AccountShellSkeleton } from "@/features/account/components/account-skeletons";
import { requireAccountUser } from "@/lib/auth/current-customer";
import { ROBOTS_PRIVATE } from "@/lib/seo/robots";

/** Signed-in pages are never indexed (robots.txt also keeps crawlers out of /account). */
export const metadata = { robots: ROBOTS_PRIVATE };

async function AccountFrame({ children }: { children: ReactNode }) {
  const user = await requireAccountUser();
  const avatarUrl: string = user.avatar?.url ?? "";
  return (
    <>
      <aside className="account-sidebar">
        <div className="account-identity">
          <span className="account-avatar" aria-hidden="true">
            {avatarUrl ? <Image src={avatarUrl} alt="" fill sizes="40px" className="cover-image" /> : (user.name || user.email).charAt(0).toUpperCase()}
          </span>
          <div>
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
        </div>
        <AccountNav />
      </aside>
      <div className="account-shell-content">{children}</div>
    </>
  );
}

/** Every account section shares the sidebar; the session is verified before anything renders. */
export default function AccountDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <main className="commerce-page content-width account-shell">
      <Suspense fallback={<AccountShellSkeleton />}>
        <AccountFrame>{children}</AccountFrame>
      </Suspense>
    </main>
  );
}
