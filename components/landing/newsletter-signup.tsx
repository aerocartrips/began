"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { visibilityClass } from "@/components/landing/home-section";
import { trackEvent } from "@/features/analytics/analytics";
import type { HomeSection } from "@/features/homepage/types";

type State = { status: "idle" | "submitting" | "done" | "error"; message: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Newsletter sign-up. The server decides double or single opt-in and never reveals existing subscribers. */
export default function NewsletterSignup({ section, title, description }: { section: HomeSection; title: string; description: string }) {
  const inputId = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ status: "idle", message: "" });
  const headingId = `home-${section.key}`;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (state.status === "submitting") return;
    const value = email.trim();
    if (!EMAIL.test(value)) {
      setState({ status: "error", message: "Enter a valid email address." });
      return;
    }
    setState({ status: "submitting", message: "" });
    try {
      const response = await fetch("/api/v1/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, source: "home" }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setState({ status: "error", message: payload?.message ?? "Something went wrong. Please try again." });
        return;
      }
      setState({ status: "done", message: payload?.message ?? "Thanks for subscribing." });
      setEmail("");
      trackEvent("newsletter_signup", { section: section.key });
    } catch {
      setState({ status: "error", message: "We couldn't reach the store. Check your connection and try again." });
    }
  }

  return (
    <section
      className={["home-newsletter content-width", visibilityClass(section)].filter(Boolean).join(" ")}
      aria-labelledby={headingId}
      data-home-section={section.key}
    >
      <div className="home-newsletter__copy">
        <Mail size={22} aria-hidden="true" />
        <div>
          <h2 id={headingId}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {state.status === "done" ? (
        <p className="home-newsletter__done" role="status">{state.message}</p>
      ) : (
        <form className="home-newsletter__form" onSubmit={onSubmit} noValidate>
          <label htmlFor={inputId} className="sr-only">Email address</label>
          <input
            id={inputId}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@business.com"
            value={email}
            maxLength={254}
            required
            aria-invalid={state.status === "error"}
            aria-describedby={`${inputId}-note`}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />
          <button type="submit" className="button button-primary" disabled={state.status === "submitting"}>
            {state.status === "submitting" ? "Subscribing…" : "Subscribe"}
          </button>
          <p id={`${inputId}-note`} className="home-newsletter__note">
            {state.status === "error" ? (
              <span role="alert">{state.message}</span>
            ) : (
              <>
                New arrivals and offers only. Unsubscribe any time. <Link href="/privacy-policy">Privacy policy</Link>
              </>
            )}
          </p>
        </form>
      )}
    </section>
  );
}
