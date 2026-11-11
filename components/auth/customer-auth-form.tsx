"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import EmailCodeForm from "@/components/auth/email-code-form";
import ErrorCard from "@/components/ui/feedback/error-card";
import LoadingButton from "@/components/ui/buttons/loading-button";
import { PasswordField, TextField } from "@/components/ui/form/text-field";
import { useCompleteSignIn } from "@/features/account/session-transitions";
import { authErrorMessage, postAuthForm } from "@/features/auth/auth-request";
import type { EmailCodeState } from "@/features/auth/types/email-code";
import { authHref, FORGOT_PASSWORD_PATH, LOGIN_PATH, REGISTER_PATH, safeRedirectPath } from "@/lib/auth/redirect";

export type AuthMode = "login" | "register";

const ENDPOINTS: Record<AuthMode, string> = {
  login: "/api/v1/auth/login",
  register: "/api/v1/auth/register",
};
const VERIFY_ENDPOINT = "/api/v1/auth/verify-email";
const RESEND_ENDPOINT = "/api/v1/auth/verify-email/resend";

/** `verification`: the email isn't verified yet; the session opens once the emailed code is entered. */
type SignInData = { verification?: EmailCodeState };

export default function CustomerAuthForm({ mode }: { mode: AuthMode }) {
  const completeSignIn = useCompleteSignIn();
  const searchParams = useSearchParams();
  // Back to the page that sent the shopper here (validated: same-site paths only), else home.
  const nextPath = safeRedirectPath(searchParams.get("next"), "/");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [verification, setVerification] = useState<EmailCodeState | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");

    const { ok, result } = await postAuthForm<SignInData>(ENDPOINTS[mode], Object.fromEntries(new FormData(event.currentTarget)));
    if (ok && result.data?.verification) {
      setVerification(result.data.verification);
      setPending(false);
      return;
    }
    if (ok) {
      // Stays pending while the destination loads, so the form can't be sent twice.
      completeSignIn(nextPath);
      return;
    }
    setError(authErrorMessage(result, "Unable to authenticate. Check your details and try again."));
    setPending(false);
  }

  async function verifyCode(code: string) {
    const { ok, result } = await postAuthForm(VERIFY_ENDPOINT, { code });
    if (!ok) return authErrorMessage(result, "That code didn't work. Try again.");
    completeSignIn(nextPath);
    return null;
  }

  async function resendCode() {
    const { ok, result } = await postAuthForm<SignInData>(RESEND_ENDPOINT, {});
    return ok && result.data?.verification ? result.data.verification : authErrorMessage(result, "We couldn't send a new code. Try again shortly.");
  }

  if (verification) {
    return (
      <EmailCodeForm
        initialState={verification}
        verify={verifyCode}
        resend={resendCode}
        purpose={mode === "register" ? "to finish creating your account" : "to finish signing in"}
        submitLabel={mode === "register" ? "Verify and continue" : "Verify and sign in"}
        footer={
          <p className="checkout-boundary">
            Wrong email address?{" "}
            <button type="button" className="account-link-button" onClick={() => setVerification(null)}>
              Go back
            </button>
          </p>
        }
      />
    );
  }

  return (
    <form className="customer-auth-form" onSubmit={handleSubmit}>
      {mode === "register" && <TextField label="Full name" name="name" autoComplete="name" minLength={2} maxLength={120} />}
      <TextField label="Business email" name="email" type="email" autoComplete="email" maxLength={254} />
      {mode === "register" && (
        <>
          <TextField label="Company name" name="companyName" autoComplete="organization" maxLength={160} optional />
          <TextField label="Phone" name="phone" type="tel" autoComplete="tel" maxLength={25} optional />
        </>
      )}
      <PasswordField
        label="Password"
        name="password"
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        minLength={8}
        maxLength={128}
      />
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
