import type { ReactNode } from "react";
import NoticeCard from "@/components/ui/feedback/notice-card";

type ErrorCardProps = {
  title: string;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
};

export default function ErrorCard({ title, description, action, className }: ErrorCardProps) {
  return (
    <NoticeCard tone="danger" live="alert" titleAs="h2" title={title} description={description} action={action} className={className} />
  );
}
