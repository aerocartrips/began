"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import ErrorCard from "@/components/ui/feedback/error-card";
import { NoticeLink } from "@/components/ui/feedback/notice-card";
import SuccessCard from "@/components/ui/feedback/success-card";
import LoadingButton from "@/components/ui/buttons/loading-button";
import { authErrorMessage, postAuthForm } from "@/features/auth/auth-request";
import { LOGIN_PATH } from "@/lib/auth/redirect";

export default function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    const { ok, result } = await postAuthForm("/api/v1/auth/forgot-password", Object.fromEntries(new FormData(event.currentTarget)));
    if (ok) setSent(result.message ?? "Check your inbox for a link to reset your password.");
    else setError(authErrorMessage(result, "We could not send the reset link. Try again shortly."));
    setPending(false);
  }

  if (sent) {
    return (
      <SuccessCard
        title="Check your email"
        description={sent}
        action={<NoticeLink href={LOGIN_PATH}>Back to sign in</NoticeLink>}
      />
    );
  }

  return (
    <form className="checkout-form customer-auth-form" onSubmit={handleSubmit}>
      <label className="checkout-field checkout-field-wide">
        Email
        <input name="email" type="email" autoComplete="email" required maxLength={254} />
      </label>
      {error ? <ErrorCard title="Reset link not sent" description={error} /> : null}
      <LoadingButton type="submit" loading={pending} loadingText="Sending link…" className="checkout-submit">
        Send reset link
      </LoadingButton>
      <p className="checkout-boundary">
        Remembered it? <Link href={LOGIN_PATH}>Sign in</Link>
      </p>
    </form>
  );
}
