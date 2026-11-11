"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import LoadingButton from "@/components/ui/buttons/loading-button";
import NoticeCard from "@/components/ui/feedback/notice-card";
import { TextField } from "@/components/ui/form/text-field";
import { EMAIL_CODE } from "@/lib/constants/account";
import type { EmailCodeState } from "@/features/auth/types/email-code";

const CODE_LENGTH = EMAIL_CODE.length;
const VALID_MINUTES = EMAIL_CODE.ttlMs / 60_000;

type EmailCodeFormProps = {
  /** The code that was sent: where to, when another may be requested, and why it wasn't sent (if so). */
  initialState: EmailCodeState;
  /** Checks a code. Resolves to the message to show under the field, or null once it is accepted. */
  verify: (code: string) => Promise<string | null>;
  /** Asks for another code. Resolves to its state, or to the message to show. */
  resend: () => Promise<EmailCodeState | string>;
  submitLabel: string;
  /** What finishing does, e.g. "to finish creating your account". */
  purpose: string;
  /** Extra actions under the form, e.g. "Use a different account". */
  footer?: ReactNode;
  /** "card": the sign-in card (full-width button). "panel": inside an account panel. */
  layout?: "card" | "panel";
  /** Moves focus to the code field when the form appears after an action (not on page load). */
  autoFocus?: boolean;
};

/**
 * The one form for entering an emailed verification code: sign-up, sign-in of
 * an unverified account, and email changes. A complete code is checked as soon
 * as it is typed or pasted (phones can fill it in from the email); "Resend"
 * unlocks when the server allows another code.
 */
export default function EmailCodeForm({ initialState, verify, resend, submitLabel, purpose, footer, layout = "card", autoFocus = true }: EmailCodeFormProps) {
  const [state, setState] = useState(initialState);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [resent, setResent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  async function submit(value: string) {
    if (verifying) return;
    setVerifying(true);
    setError("");
    const problem = await verify(value);
    // Accepted: stays busy while the caller moves on (navigation, or a re-render without this form).
    if (problem) {
      setError(problem);
      setVerifying(false);
    }
  }

  function handleChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(digits);
    setError("");
    if (digits.length === CODE_LENGTH) void submit(digits);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.length === CODE_LENGTH) void submit(code);
    else setError(`Enter the ${CODE_LENGTH}-digit code from the email.`);
  }

  async function handleResend() {
    setResending(true);
    setError("");
    const result = await resend();
    if (typeof result === "string") {
      setError(result);
    } else {
      setState(result);
      setCode("");
      setResent(true);
    }
    setResending(false);
  }

  const notSent = Boolean(state.error);
  const resendButton = <ResendButton key={state.resendAt} resendAt={state.resendAt} busy={resending} disabled={verifying} onResend={() => void handleResend()} />;

  return (
    <form className={layout === "card" ? "customer-auth-form" : "account-form-grid account-subform"} onSubmit={handleSubmit} noValidate>
      <NoticeCard
        className={layout === "panel" ? "is-wide" : undefined}
        tone={notSent ? "warning" : "info"}
        live="status"
        title={notSent ? "Code not sent" : resent ? "New code sent" : "Check your email"}
        description={
          notSent ? (
            state.error
          ) : (
            <>
              Enter the {CODE_LENGTH}-digit code we sent to <strong>{state.email}</strong> {purpose}. It expires in {VALID_MINUTES} minutes.
            </>
          )
        }
      />
      <TextField
        label="Verification code"
        name="code"
        value={code}
        onChange={(event) => handleChange(event.currentTarget.value)}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        spellCheck={false}
        error={error}
        autoFocus={autoFocus}
        wide={layout === "panel"}
      />
      {layout === "card" ? (
        <>
          <LoadingButton type="submit" loading={verifying} loadingText="Verifying…" className="checkout-submit">
            {submitLabel}
          </LoadingButton>
          <p className="checkout-boundary">Didn&apos;t get it? Check your spam folder. {resendButton}</p>
          {footer}
        </>
      ) : (
        <div className="account-form-actions is-wide">
          {footer}
          {resendButton}
          <LoadingButton type="submit" size="sm" loading={verifying} loadingText="Verifying…">
            {submitLabel}
          </LoadingButton>
        </div>
      )}
    </form>
  );
}

const secondsUntil = (time: number) => (Number.isFinite(time) ? Math.max(0, Math.ceil((time - Date.now()) / 1000)) : 0);

/** "Resend code", locked with a countdown until the server allows another code. Remount (key) for each new code. */
function ResendButton({ resendAt, busy, disabled, onResend }: { resendAt: string; busy: boolean; disabled: boolean; onResend: () => void }) {
  const until = Date.parse(resendAt);
  const [left, setLeft] = useState(() => secondsUntil(until));

  useEffect(() => {
    if (secondsUntil(until) === 0) return;
    const timer = setInterval(() => {
      const next = secondsUntil(until);
      setLeft(next);
      if (next === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [until]);

  return (
    <button type="button" className="account-link-button" onClick={onResend} disabled={busy || disabled || left > 0}>
      {busy ? "Sending…" : left > 0 ? `Resend code in ${left}s` : "Resend code"}
    </button>
  );
}
