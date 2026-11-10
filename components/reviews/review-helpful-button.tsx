"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ThumbsUp } from "lucide-react";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { apiRequest } from "@/lib/api/api-client";
import { isClientApiError } from "@/lib/api/api-error";
import { authHref } from "@/lib/auth/redirect";
import { formatNumber } from "@/lib/format";

/**
 * "Helpful" vote on a published review. Signed-out shoppers go to sign in and
 * come back to the reviews; a second press takes the vote back.
 */
export default function ReviewHelpfulButton({ reviewId, initialCount }: { reviewId: string; initialCount: number }) {
  const feedback = useFeedback();
  const router = useRouter();
  const pathname = usePathname();
  const [count, setCount] = useState(initialCount);
  const [voted, setVoted] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const response = await apiRequest<{ helpfulCount: number }>(`/api/v1/reviews/${encodeURIComponent(reviewId)}/helpful`, {
        method: voted ? "DELETE" : "POST",
      });
      setCount(response.data?.helpfulCount ?? Math.max(0, count + (voted ? -1 : 1)));
      setVoted(!voted);
    } catch (error) {
      if (isClientApiError(error) && error.status === 401) {
        router.push(authHref(`${pathname}#product-reviews`));
        return;
      }
      feedback.error("Could not save your vote", error instanceof Error ? error.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="review-helpful">
      <button type="button" className="review-helpful-button" aria-pressed={voted} disabled={busy} onClick={() => void toggle()}>
        <ThumbsUp size={14} aria-hidden="true" fill={voted ? "currentColor" : "none"} />
        Helpful
      </button>
      {count > 0 ? (
        <span className="review-helpful-note">
          {formatNumber(count)} {count === 1 ? "person" : "people"} found this helpful
        </span>
      ) : null}
    </div>
  );
}
