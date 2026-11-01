"use client";

import { useState } from "react";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { ThumbsUp } from "lucide-react";
import { useAsyncAction } from "@/hooks/use-async-action";
import { apiRequest } from "@/lib/api/api-client";

type ReviewHelpfulProps = {
  reviewId: string;
  initialCount: number;
  showVoting: boolean;
};

export default function ReviewHelpfulButton({ reviewId, initialCount, showVoting }: ReviewHelpfulProps) {
  const feedback = useFeedback();
  const [count, setCount] = useState(initialCount);
  const [voted, setVoted] = useState(false);

  const { run: vote, loading } = useAsyncAction(async () => {
    if (voted) {
      const response = await apiRequest<{ helpfulCount: number }>(`/api/v1/reviews/${reviewId}/helpful`, {
        method: "DELETE",
      });
      setCount(response.data?.helpfulCount ?? count - 1);
      setVoted(false);
      return null;
    }
    const response = await apiRequest<{ helpfulCount: number }>(`/api/v1/reviews/${reviewId}/helpful`, {
      method: "POST",
    });
    setCount(response.data?.helpfulCount ?? count + 1);
    setVoted(true);
    return null;
  });

  if (!showVoting) return null;

  return (
    <div className="review-helpful">
      <span>{count > 0 ? `${count} ${count === 1 ? "person" : "people"} found this helpful` : "Was this review helpful?"}</span>
      <button
        type="button"
        className={voted ? "review-helpful-button is-active" : "review-helpful-button"}
        aria-pressed={voted}
        disabled={loading}
        onClick={() => void vote()}
      >
        <ThumbsUp size={12} aria-hidden="true" />
        {voted ? "Helpful" : "Yes"}
      </button>
    </div>
  );
}
