"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api/api-client";
import { announceSessionChange } from "@/lib/client/session-events";
import { wishlistActions } from "@/features/wishlist/wishlist-store";

/** Per-session client state to drop whenever the signed-in user changes, in any tab. */
export function resetSessionState() {
  wishlistActions.resetSession();
}

let reconcileInFlight: Promise<boolean | null> | null = null;

/**
 * Has /auth/user-check renew an expired access token or clear dead cookies.
 * Resolves to whether the shopper is signed in (null if the check failed).
 * Concurrent callers share one request.
 */
export function reconcileSessionCookies() {
  reconcileInFlight ??= apiRequest<{ authenticated: boolean }>("/api/v1/auth/user-check")
    .then((result) => Boolean(result.data?.authenticated))
    .catch(() => null)
    .finally(() => {
      reconcileInFlight = null;
    });
  return reconcileInFlight;
}

/**
 * Finishes a sign-in in this tab: replaces the sign-in page with `destination`
 * (Back won't return to the form) and re-renders the server UI, header
 * included, with the new session. The refresh is queued behind the
 * navigation, so it renders the destination.
 */
export function useCompleteSignIn() {
  const router = useRouter();
  return useCallback(
    (destination: string) => {
      resetSessionState();
      announceSessionChange();
      router.replace(destination);
      router.refresh();
    },
    [router],
  );
}

/**
 * Finishes a sign-out with a full page load. Soft navigation would keep the
 * account in memory: the router cache and the pages preserved for Back
 * (Activity) could show it again after signing out.
 */
export function completeSignOut(destination = "/") {
  resetSessionState();
  announceSessionChange();
  window.location.assign(destination);
}
