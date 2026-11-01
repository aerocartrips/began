"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ErrorCard from "@/components/ui/feedback/error-card";
import LoadingButton from "@/components/ui/buttons/loading-button";

type AuthMode = "login" | "register";

type AuthResponse = {
  success?: boolean;
  message?: string;
  errors?: { field: string; message: string }[];
};

export default function CustomerAuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/checkout";
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());
    const endpoint = mode === "login" ? "/api/v1/auth/login" : "/api/v1/auth/register";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as AuthResponse;
      if (response.ok && result.success) {
        router.push(nextPath);
        router.refresh();
        return;
      }
      setError(result.message ?? "Unable to authenticate. Check your details and try again.");
    } catch {
      setError("Unable to reach the authentication service.");
    } finally {
      setPending(false);
    }
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
      {error ? (
        <ErrorCard
          title={mode === "login" ? "Sign in failed" : "Registration failed"}
          description={error}
        />
      ) : null}
      <LoadingButton
        type="submit"
        loading={pending}
        loadingText="Please wait..."
        className="checkout-submit"
      >
        {mode === "login" ? "Sign in" : "Create account"}
      </LoadingButton>
      <p className="checkout-boundary">
        {mode === "login" ? (
          <>Need a wholesale account? <Link href={`/account/register?next=${encodeURIComponent(nextPath)}`}>Register</Link></>
        ) : (
          <>Already registered? <Link href={`/account/login?next=${encodeURIComponent(nextPath)}`}>Sign in</Link></>
        )}
      </p>
    </form>
  );
}
