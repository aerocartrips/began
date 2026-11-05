import CustomerAccountMenu from "@/components/layout/customer-account-menu";
import { getCurrentSession } from "@/lib/auth/current-customer";
import { toSessionUser } from "@/lib/auth/session-user";

/**
 * The header's account area, rendered on the server from the session cookie:
 * correct on first paint and after every router.refresh() (sign-in, sign-out),
 * with no session request from the browser. The page shares this request's
 * session read (React cache), so it costs no extra lookup.
 */
export default async function HeaderAccount() {
  const { user, status } = await getCurrentSession();
  return (
    <CustomerAccountMenu
      user={user ? toSessionUser(user) : null}
      reconcile={status === "renewable" || status === "invalid"}
    />
  );
}

export function HeaderAccountFallback() {
  return <span className="account-menu-placeholder account-menu-placeholder--icon" aria-hidden="true" />;
}
