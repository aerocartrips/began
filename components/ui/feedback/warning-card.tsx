import type { ReactNode } from "react";
import NoticeCard from "@/components/ui/feedback/notice-card";

type WarningCardProps = {
  title: string;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
};

export default function WarningCard({ title, description, action, className }: WarningCardProps) {
  return (
    <NoticeCard tone="warning" live="status" titleAs="h2" title={title} description={description} action={action} className={className} />
  );
}
