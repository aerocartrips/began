"use client";

import type { ReactNode } from "react";
import FeedbackContainer from "@/components/feedback/feedback-container";
import { FeedbackProvider } from "@/components/feedback/feedback-provider";

export default function AdminFeedbackRoot({ children }: { children: ReactNode }) {
  return (
    <FeedbackProvider>
      {children}
      <FeedbackContainer />
    </FeedbackProvider>
  );
}
