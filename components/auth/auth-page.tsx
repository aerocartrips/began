import { Suspense } from "react";
import { redirect } from "next/navigation";
import AuthCard from "@/components/auth/auth-card";
import CustomerAuthForm, { type AuthMode } from "@/components/auth/customer-auth-form";
import Skeleton from "@/components/ui/loaders/skeleton";
import { getCurrentAccountUser } from "@/lib/auth/current-customer";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { getCurrentTenant } from "@/lib/tenant/current";

export type AuthSearchParams = Promise<Record<string, string | string[] | undefined>>;

const COPY = {
  login: {
    title: "Sign in",
    lead: {
      wholesale: "Welcome back. Sign in to place orders, track shipments and download invoices.",
      retail: "Welcome back. Sign in to check out faster and follow your orders.",
    },
  },
  register: {
    title: "Create account",
    lead: {
      wholesale: "Register your business to order at wholesale prices and manage bulk orders online.",
      retail: "Create an account to check out faster, save addresses and track your orders.",
    },
  },
} as const;

const FIELD_COUNT: Record<AuthMode, number> = { login: 2, register: 5 };

/**
 * Sign-in and register pages: one centred card. proxy.ts already sends
 * visitors with a valid access token onwards; RedirectIfSignedIn covers the
 * sessions it can't see (an expired access token with a valid refresh token).
 */
export default async function AuthPage({ mode, searchParams }: { mode: AuthMode; searchParams: AuthSearchParams }) {
  const { salesMode } = await getCurrentTenant();
  const copy = COPY[mode];

  return (
    <AuthCard
      eyebrow={salesMode === "wholesale" ? "Wholesale account" : "Your account"}
      title={copy.title}
      lead={copy.lead[salesMode]}
    >
      <Suspense fallback={null}>
        <RedirectIfSignedIn searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<AuthFormSkeleton fields={FIELD_COUNT[mode]} />}>
        <CustomerAuthForm mode={mode} />
      </Suspense>
    </AuthCard>
  );
}

async function RedirectIfSignedIn({ searchParams }: { searchParams: AuthSearchParams }) {
  const [params, user] = await Promise.all([searchParams, getCurrentAccountUser()]);
  if (user) {
    const next = Array.isArray(params.next) ? params.next[0] : params.next;
    redirect(safeRedirectPath(next, "/"));
  }
  return null;
}

/** Same height as the form, so the card doesn't jump when it loads. */
function AuthFormSkeleton({ fields }: { fields: number }) {
  return (
    <div className="auth-form-skeleton" aria-busy="true" aria-label="Loading form">
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className="auth-form-skeleton__field">
          <Skeleton className="auth-form-skeleton__label" />
          <Skeleton className="auth-form-skeleton__input" />
        </div>
      ))}
      <Skeleton className="auth-form-skeleton__button" />
    </div>
  );
}
