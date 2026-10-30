import type { ReactNode } from "react";

type BadgeProps = {
  tone?: "light" | "dark";
  children: ReactNode;
};

export default function Badge({ tone = "light", children }: BadgeProps) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}