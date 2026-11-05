"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { accountApi } from "@/features/account/account-api";

/**
 * Sign out at the end of the account overview. Phones only (see app/mobile.css):
 * there the header account menu, which has its own sign out, gives way to the tab bar.
 */
export default function AccountSignOut() {
  const router = useRouter();
  const feedback = useFeedback();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await accountApi.logout();
      router.push("/");
      router.refresh();
    } catch (error) {
      feedback.error("Sign out failed", error instanceof Error ? error.message : undefined);
      setPending(false);
    }
  }

  return (
    <button type="button" className="account-sign-out" onClick={() => void signOut()} disabled={pending}>
      <LogOut size={17} aria-hidden="true" />
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
