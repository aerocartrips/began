import type { ReactNode } from "react";
import NoticeCard from "@/components/ui/feedback/notice-card";

type PendingCardProps = {
  title: string;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
};

export default function PendingCard({ title, description, action, className }: PendingCardProps) {
  return (
    <NoticeCard tone="pending" live="status" busy titleAs="h2" title={title} description={description} action={action} className={className} />
  );
}
