import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, Info, Package } from "lucide-react";
import Button from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import AccountHeading from "@/features/account/components/account-heading";
import AccountSignOut from "@/features/account/components/account-sign-out";
import { AddressSummary } from "@/features/account/components/address-card";
import { AccountSectionSkeleton } from "@/features/account/components/account-skeletons";
import { ACCOUNT_NAV_ITEMS } from "@/features/account/nav-items";
import OrderStatusBadge from "@/features/orders/order-status-badge";
import { requireAccountUser } from "@/lib/auth/current-customer";
import { withCurrentTenant } from "@/lib/tenant/current";
import { getAccountOverview } from "@/lib/services/account.service";
import { formatDate, formatDateTime, formatRupees } from "@/lib/format";
import type { AccountProfile, SavedAddress } from "@/features/account/types";

export const metadata = {
  title: "My Account",
  description: "Manage your account, orders and addresses.",
};

const ACTION_ICONS = { warning: AlertTriangle, danger: AlertTriangle, info: Info };

async function AccountOverview() {
  const user = await requireAccountUser();
  const overview = await withCurrentTenant(() => getAccountOverview(user));
  const profile = overview.profile as AccountProfile;
  const defaultShipping = overview.defaultShipping as SavedAddress | null;
  const { completion, orderSummary, recentOrders, actions, security } = overview;

  return (
    <>
      <AccountHeading
        title={`Welcome, ${profile.firstName || "there"}`}
        lead="Your orders, addresses and account settings in one place."
        actions={<Button href="/products" variant="secondary" size="sm">Browse catalog</Button>}
      />

      {actions.length ? (
        <ul className="account-actions" aria-label="Things that need your attention">
          {actions.map((action) => {
            const Icon = ACTION_ICONS[action.tone as keyof typeof ACTION_ICONS] ?? Info;
            return (
              <li key={action.key} className={`account-action is-${action.tone}`}>
                <Icon size={16} aria-hidden="true" />
                <div>
                  <strong>{action.title}</strong>
                  <span>{action.description}</span>
                </div>
                <Link href={action.href} className="account-link-button">
                  {action.cta} <ArrowRight size={13} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="account-stats account-stats--four" aria-label="Order summary">
        <article><strong>{orderSummary.total}</strong><span>Total orders</span></article>
        <article><strong>{orderSummary.pendingPayment}</strong><span>Awaiting payment</span></article>
        <article><strong>{orderSummary.inProgress}</strong><span>In progress</span></article>
        <article><strong>{orderSummary.delivered}</strong><span>Delivered</span></article>
      </div>

      <div className="account-grid">
        <section className="account-panel" aria-labelledby="overview-completion-title">
          <div className="account-panel-head">
            <h2 id="overview-completion-title">Profile completion</h2>
            <span>{completion.percent}%</span>
          </div>
          <div
            className="account-progress"
            role="progressbar"
            aria-valuenow={completion.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-labelledby="overview-completion-title"
          >
            <span style={{ width: `${completion.percent}%` }} />
          </div>
          <ul className="account-checklist">
            {completion.items.map((item) => (
              <li key={item.key} className={item.done ? "is-done" : undefined}>
                {item.done ? <CheckCircle2 size={15} aria-hidden="true" /> : <Circle size={15} aria-hidden="true" />}
                {item.done ? <span>{item.label}</span> : <Link href={item.href}>{item.label}</Link>}
                <span className="sr-only">{item.done ? "(complete)" : "(to do)"}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="account-panel" aria-labelledby="overview-profile-title">
          <div className="account-panel-head">
            <h2 id="overview-profile-title">Personal information</h2>
            <Link href="/account/profile" className="account-link-button">Edit</Link>
          </div>
          <dl className="account-facts is-stacked">
            <div><dt>Name</dt><dd>{profile.name}</dd></div>
            <div><dt>Email</dt><dd>{profile.email}{profile.isEmailVerified ? "" : " (not verified)"}</dd></div>
            <div><dt>Phone</dt><dd>{profile.phone || "Not added"}</dd></div>
            <div><dt>Business</dt><dd>{profile.companyName || "Not added"}{profile.gstNumber ? ` · GSTIN ${profile.gstNumber}` : ""}</dd></div>
          </dl>
        </section>

        <section className="account-panel" aria-labelledby="overview-address-title">
          <div className="account-panel-head">
            <h2 id="overview-address-title">Default shipping address</h2>
            <Link href="/account/addresses" className="account-link-button">
              {overview.addressCount > 0 ? `Manage (${overview.addressCount})` : "Add"}
            </Link>
          </div>
          {defaultShipping ? (
            <AddressSummary address={defaultShipping} />
          ) : (
            <p className="account-muted">No address saved yet. Add one to check out faster.</p>
          )}
        </section>

        <section className="account-panel" aria-labelledby="overview-security-title">
          <div className="account-panel-head">
            <h2 id="overview-security-title">Account security</h2>
            <Link href="/account/security" className="account-link-button">Manage</Link>
          </div>
          <dl className="account-facts is-stacked">
            <div><dt>Password</dt><dd>{security.passwordChangedAt ? `Changed ${formatDate(security.passwordChangedAt)}` : "Unchanged since sign-up"}</dd></div>
            <div><dt>Last sign-in</dt><dd>{formatDateTime(security.lastLoginAt, "Not recorded yet")}</dd></div>
            <div><dt>Email verification</dt><dd>{security.isEmailVerified ? "Verified" : "Pending"}</dd></div>
          </dl>
        </section>
      </div>

      <section className="account-panel" aria-labelledby="overview-orders-title">
        <div className="account-panel-head">
          <h2 id="overview-orders-title">Recent orders</h2>
          <Link href="/account/orders" className="account-link-button">View all</Link>
        </div>
        {recentOrders.length === 0 ? (
          <EmptyState
            className="account-empty"
            icon={<Package size={20} />}
            title="No orders yet"
            description="Your wholesale orders will appear here once placed."
            action={<Button href="/products" size="sm">Browse catalog</Button>}
          />
        ) : (
          <ul className="account-order-list">
            {recentOrders.map((order) => (
              <li key={order.id}>
                <Link href={`/account/orders/${order.id}`}>
                  <span className="account-order-main">
                    <strong>{order.orderNumber}</strong>
                    <small>{formatDate(order.createdAt)} · {order.itemCount} units · {order.firstItemName}</small>
                  </span>
                  <OrderStatusBadge kind="order" status={order.orderStatus} />
                  <strong className="account-order-total">{formatRupees(order.totalAmount)}</strong>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav className="account-quicklinks" aria-label="Account sections">
        {ACCOUNT_NAV_ITEMS.slice(1).map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}>
            <Icon size={16} aria-hidden="true" />
            <span>{label}</span>
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        ))}
      </nav>
      <AccountSignOut />
    </>
  );
}

export default function AccountOverviewPage() {
  return (
    <Suspense fallback={<AccountSectionSkeleton panels={3} />}>
      <AccountOverview />
    </Suspense>
  );
}
