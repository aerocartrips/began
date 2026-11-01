"use client";

import { useState } from "react";
import Button from "@/components/ui/button";
import LoadingButton from "@/components/ui/buttons/loading-button";
import ErrorCard from "@/components/ui/feedback/error-card";
import SuccessCard from "@/components/ui/feedback/success-card";
import { accountApi } from "@/features/account/account-api";

type State = { status: "idle" | "verifying" } | { status: "done"; email: string } | { status: "error"; message: string };

/**
 * Verification is an explicit click rather than automatic on load, so link
 * scanners and prefetchers cannot consume the single-use token.
 */
export default function VerifyEmailClient({ token }: { token: string }) {
  const [state, setState] = useState<State>(
    token ? { status: "idle" } : { status: "error", message: "This verification link is incomplete." },
  );

  async function verify() {
    setState({ status: "verifying" });
    try {
      const result = await accountApi.confirmEmail(token);
      setState({ status: "done", email: result.data?.email ?? "" });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "This verification link is invalid or has expired." });
    }
  }

  if (state.status === "done") {
    return (
      <SuccessCard
        title="Email address confirmed"
        description={state.email ? `${state.email} is now the verified email on your Norosilk account.` : "Your email address is verified."}
        action={<Button href="/account" size="sm">Go to my account</Button>}
      />
    );
  }

  if (state.status === "error") {
    return (
      <ErrorCard
        title="We could not verify this link"
        description={`${state.message} Request a new link from your profile.`}
        action={<Button href="/account/profile" size="sm">Open profile</Button>}
      />
    );
  }

  return (
    <section className="account-panel account-verify">
      <h2>Confirm your email address</h2>
      <p className="account-muted">Confirm to finish verifying the email address on your Norosilk account.</p>
      <LoadingButton size="sm" loading={state.status === "verifying"} loadingText="Confirming..." onClick={() => void verify()}>
        Confirm email address
      </LoadingButton>
    </section>
  );
}
