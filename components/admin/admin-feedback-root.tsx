"use client";

import type { ReactNode } from "react";
import FeedbackContainer from "@/components/feedback/FeedbackContainer";
import { FeedbackProvider } from "@/components/feedback/FeedbackProvider";

export default function AdminFeedbackRoot({ children }: { children: ReactNode }) {
  return (
    <FeedbackProvider>
      {children}
      <FeedbackContainer />
    </FeedbackProvider>
  );
}
