import type { ReactNode } from "react";
import NoticeCard from "@/components/ui/feedback/notice-card";

type SuccessCardProps = {
  title: string;
  description: ReactNode;
  detail?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export default function SuccessCard({ title, description, detail, action, className }: SuccessCardProps) {
  return (
    <NoticeCard
      tone="success"
      live="status"
      titleAs="h2"
      title={title}
      description={description}
      detail={detail}
      action={action}
      className={className}
    />
  );
}
