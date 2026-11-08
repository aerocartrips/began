"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import Button from "@/components/ui/button";
import ErrorCard from "@/components/ui/feedback/error-card";
import SuccessCard from "@/components/ui/feedback/success-card";
import LoadingButton from "@/components/ui/buttons/loading-button";
import { authErrorMessage, postAuthForm } from "@/features/auth/auth-request";
import { FORGOT_PASSWORD_PATH, LOGIN_PATH } from "@/lib/auth/redirect";

type State = { status: "idle" | "saving" } | { status: "done" } | { status: "error"; message: string; expired: boolean };

/**
 * The new password is sent only when the shopper submits, so link scanners and
 * prefetchers that open the emailed link cannot use up the single-use token.
 */
export default function ResetPasswordForm({ token }: { token: string }) {
  const [state, setState] = useState<State>(
    token ? { status: "idle" } : { status: "error", message: "This reset link is incomplete.", expired: true },
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.status === "saving") return;
    setState({ status: "saving" });
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const { ok, result } = await postAuthForm("/api/v1/auth/reset-password", { ...form, token });
    if (ok) {
      setState({ status: "done" });
      return;
    }
    // 400 means the link itself is unusable; field errors (422) leave the form open.
    const expired = !result.errors?.length;
    setState({ status: "error", message: authErrorMessage(result, "We could not change your password."), expired });
  }

  if (state.status === "done") {
    return (
      <SuccessCard
        title="Password changed"
        description="You've been signed out everywhere for safety. Sign in with your new password."
        action={<Button href={LOGIN_PATH} size="sm">Sign in</Button>}
      />
    );
  }

  if (state.status === "error" && state.expired) {
    return (
      <ErrorCard
        title="This link can't be used"
        description={`${state.message} Reset links work once, for 30 minutes.`}
        action={<Button href={FORGOT_PASSWORD_PATH} size="sm">Request a new link</Button>}
      />
    );
  }

  return (
    <form className="checkout-form customer-auth-form" onSubmit={handleSubmit}>
      <label className="checkout-field checkout-field-wide">
        New password
        <input name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
      </label>
      <label className="checkout-field checkout-field-wide">
        Confirm new password
        <input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
      </label>
      {state.status === "error" ? <ErrorCard title="Password not changed" description={state.message} /> : null}
      <LoadingButton type="submit" loading={state.status === "saving"} loadingText="Saving…" className="checkout-submit">
        Set new password
      </LoadingButton>
      <p className="checkout-boundary">
        Use at least 8 characters with a letter and a number. <Link href={LOGIN_PATH}>Back to sign in</Link>
      </p>
    </form>
  );
}
