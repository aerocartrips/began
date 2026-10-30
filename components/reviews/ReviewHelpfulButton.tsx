"use client";

import { useState } from "react";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import LoadingButton from "@/components/ui/buttons/LoadingButton";
import { useAsyncAction } from "@/hooks/useAsyncAction";
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
      <span>{count} found this helpful</span>
      <LoadingButton type="button" variant="secondary" loading={loading} onClick={() => void vote()}>
        {voted ? "Remove vote" : "Yes, helpful"}
      </LoadingButton>
    </div>
  );
}
