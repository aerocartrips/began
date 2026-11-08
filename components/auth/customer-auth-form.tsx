"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ErrorCard from "@/components/ui/feedback/error-card";
import LoadingButton from "@/components/ui/buttons/loading-button";
import { useCompleteSignIn } from "@/features/account/session-transitions";
import { authErrorMessage, postAuthForm } from "@/features/auth/auth-request";
import { authHref, FORGOT_PASSWORD_PATH, LOGIN_PATH, REGISTER_PATH, safeRedirectPath } from "@/lib/auth/redirect";

export type AuthMode = "login" | "register";

const ENDPOINTS: Record<AuthMode, string> = {
  login: "/api/v1/auth/login",
  register: "/api/v1/auth/register",
};

export default function CustomerAuthForm({ mode }: { mode: AuthMode }) {
  const completeSignIn = useCompleteSignIn();
  const searchParams = useSearchParams();
  // Back to the page that sent the shopper here (validated: same-site paths only), else home.
  const nextPath = safeRedirectPath(searchParams.get("next"), "/");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");

    const { ok, result } = await postAuthForm(ENDPOINTS[mode], Object.fromEntries(new FormData(event.currentTarget)));
    if (ok) {
      // Stays pending while the destination loads, so the form can't be sent twice.
      completeSignIn(nextPath);
      return;
    }
    setError(authErrorMessage(result, "Unable to authenticate. Check your details and try again."));
    setPending(false);
  }

  return (
    <form className="checkout-form customer-auth-form" onSubmit={handleSubmit}>
      {mode === "register" && (
        <label className="checkout-field checkout-field-wide">
          Full name
          <input name="name" autoComplete="name" required minLength={2} maxLength={120} />
        </label>
      )}
      <label className="checkout-field checkout-field-wide">
        Business email
        <input name="email" type="email" autoComplete="email" required maxLength={254} />
      </label>
      {mode === "register" && (
        <>
          <label className="checkout-field checkout-field-wide">
            Company name
            <input name="companyName" autoComplete="organization" maxLength={160} />
          </label>
          <label className="checkout-field checkout-field-wide">
            Phone
            <input name="phone" type="tel" autoComplete="tel" maxLength={25} />
          </label>
        </>
      )}
      <label className="checkout-field checkout-field-wide">
        Password
        <input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} maxLength={128} />
      </label>
      {mode === "login" ? (
        <p className="checkout-boundary">
          <Link href={FORGOT_PASSWORD_PATH}>Forgot your password?</Link>
        </p>
      ) : null}
      {error ? (
        <ErrorCard
          title={mode === "login" ? "Sign in failed" : "Registration failed"}
          description={error}
        />
      ) : null}
      <LoadingButton
        type="submit"
        loading={pending}
        loadingText={mode === "login" ? "Signing in…" : "Creating account…"}
        className="checkout-submit"
      >
        {mode === "login" ? "Sign in" : "Create account"}
      </LoadingButton>
      <p className="checkout-boundary">
        {mode === "login" ? (
          <>Need a wholesale account? <Link href={authHref(nextPath, REGISTER_PATH)}>Register</Link></>
        ) : (
          <>Already registered? <Link href={authHref(nextPath, LOGIN_PATH)}>Sign in</Link></>
        )}
      </p>
    </form>
  );
}
